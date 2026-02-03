import { AdSpecs } from "./parse-specs";
import { PhotoLayout } from "./photo-composer";
import { cmToPx } from "../utils/unit-converter";
import { cloneFills, getImageTransform, findFirstTextNode } from "../utils/figma-helpers";

// --- Структура данных мастера ---
export interface MasterData {
  frame: FrameNode;
  photoNode: SceneNode;  // Компонент photo для размеров и позиции
  photoImageBytes: Uint8Array;
  photoImageTransform: Transform | null;
  logoNode: SceneNode;
  headlineNode: SceneNode;
  sublineNode: SceneNode;
  disclaimerNode: SceneNode;
  goLogoNode: SceneNode;
  textZoneNode: FrameNode;
  textBgNode: RectangleNode;
  bottomBarNode: RectangleNode;
}

// --- Читаем мастер из Figma ---
// Пользователь должен выделить артборд "master" перед вызовом
export async function readMaster(): Promise<MasterData> {
  const selected = figma.currentPage.selection[0];
  if (!selected || selected.type !== "FRAME" || selected.name !== "master") {
    throw new Error('Выделите артборд "master" в Figma');
  }
  const frame = selected as FrameNode;

  // --- Читаем photo ---
  // photo — это компонент. Внутри компонента ищем Rectangle с image fill
  const photoComponent = frame.findOne(n => n.name === "photo");
  if (!photoComponent) throw new Error('Слой "photo" не найден');

  const { imageHash, imageTransform } = getImageTransform(photoComponent);
  if (!imageHash) throw new Error("Изображение внутри photo не найдено");

  const image = figma.getImageByHash(imageHash);
  if (!image) throw new Error("Не удалось получить изображение из Figma");
  const imageBytes = await image.getBytesAsync();

  // --- Читаем остальные слои по имени ---
  const logoNode = frame.findOne(n => n.name === "logo");
  const headlineNode = frame.findOne(n => n.name === "headline");
  const sublineNode = frame.findOne(n => n.name === "subline");
  const disclaimerNode = frame.findOne(n => n.name === "disclaimer");
  const goLogoNode = frame.findOne(n => n.name === "go-logo");
  const textZoneNode = frame.findOne(n => n.name === "text-zone");
  const textBgNode = frame.findOne(n => n.name === "text-bg");
  const bottomBarNode = frame.findOne(n => n.name === "bottom-bar");

  // Проверяем что всё найдено
  const required: Record<string, SceneNode | null> = {
    logo: logoNode,
    headline: headlineNode,
    subline: sublineNode,
    disclaimer: disclaimerNode,
    "go-logo": goLogoNode,
    "text-zone": textZoneNode,
    "text-bg": textBgNode,
    "bottom-bar": bottomBarNode
  };
  
  for (const [name, node] of Object.entries(required)) {
    if (!node) throw new Error(`Слой "${name}" не найден в мастере`);
  }

  return {
    frame,
    photoNode: photoComponent,
    photoImageBytes: imageBytes,
    photoImageTransform: imageTransform,
    logoNode: logoNode!,
    headlineNode: headlineNode!,
    sublineNode: sublineNode!,
    disclaimerNode: disclaimerNode!,
    goLogoNode: goLogoNode!,
    textZoneNode: textZoneNode as FrameNode,
    textBgNode: textBgNode as RectangleNode,
    bottomBarNode: bottomBarNode as RectangleNode,
  };
}

// --- Генерация нового артборда ---
export async function generateAdArtboard(
  master: MasterData,
  specs: AdSpecs,
  layout: PhotoLayout,
  text?: { headline?: string; subline?: string; disclaimer?: string }
): Promise<FrameNode> {
  const dpi = specs.dpi;
  const totalW = cmToPx(specs.total_width_cm, dpi);
  const totalH = cmToPx(specs.total_height_cm, dpi);

  // Вычисляем пропорции из мастера
  const masterW = master.frame.width;
  const masterH = master.frame.height;
  const masterTextW = master.textBgNode.width;
  const masterPhotoW = masterW - masterTextW;
  const masterSplitRatio = masterPhotoW / masterW;
  
  // Применяем те же пропорции к новому размеру
  const photoW = Math.round(totalW * masterSplitRatio);
  const textW = totalW - photoW;

  // Общий масштаб (по высоте, чтобы сохранить пропорции)
  const scale = totalH / masterH;
  
  // #region agent log
  console.log('[DEBUG] Master dimensions:', { masterW, masterH, masterTextW, masterPhotoW, masterSplitRatio });
  console.log('[DEBUG] New dimensions:', { totalW, totalH, photoW, textW, scale });
  console.log('[DEBUG] Master logo pos:', { x: master.logoNode.x, y: master.logoNode.y, w: master.logoNode.width, h: master.logoNode.height });
  console.log('[DEBUG] Master headline pos:', { x: master.headlineNode.x, y: master.headlineNode.y });
  console.log('[DEBUG] Master textBg pos:', { x: master.textBgNode.x, y: master.textBgNode.y });
  console.log('[DEBUG] Master bottomBar:', { x: master.bottomBarNode.x, y: master.bottomBarNode.y, w: master.bottomBarNode.width, h: master.bottomBarNode.height });
  // #endregion

  // ЕДИНЫЙ масштаб для всего (сохраняем пропорции мастера)
  const uniformScale = totalH / masterH;

  // Высота bottom-bar пропорционально
  const bottomBarH = Math.round(master.bottomBarNode.height * uniformScale);

  // Начало текстовой зоны (X координата)  
  const textZoneX = layout.text_zone === "left" ? 0 : photoW;
  const photoZoneX = layout.photo_zone === "right" ? textW : 0;
  
  // #region agent log
  console.log('[DEBUG] uniformScale:', uniformScale, 'masterW:', masterW, 'masterH:', masterH, 'totalW:', totalW, 'totalH:', totalH);
  // #endregion

  // =============================================
  // 1. АРТБОРД
  // =============================================
  const artboard = figma.createFrame();
  artboard.name = specs.name || "Ad_" + Date.now();
  artboard.resize(totalW, totalH);
  artboard.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];

  // Функция для получения абсолютной позиции элемента относительно артборда мастера
  const masterFrameBox = master.frame.absoluteBoundingBox!;
  function getRelativePos(node: SceneNode): { x: number; y: number } {
    const box = node.absoluteBoundingBox!;
    return {
      x: box.x - masterFrameBox.x,
      y: box.y - masterFrameBox.y,
    };
  }

  // =============================================
  // 2. ФОТОГРАФИЯ - масштабируем из мастера
  // =============================================
  const photoRect = figma.createRectangle();
  photoRect.name = "photo";
  photoRect.resize(master.photoNode.width * uniformScale, master.photoNode.height * uniformScale);
  const photoPos = getRelativePos(master.photoNode);
  photoRect.x = photoPos.x * uniformScale;
  photoRect.y = photoPos.y * uniformScale;

  // Создаём image с FILL (автоматически центрирует и заполняет)
  const figmaImage = figma.createImage(master.photoImageBytes);
  photoRect.fills = [{
    type: "IMAGE",
    imageHash: figmaImage.hash,
    scaleMode: "FILL",
  }];
  artboard.appendChild(photoRect);

  // =============================================
  // 3. СИНИЙ ФОН ТЕКСТОВОЙ ЗОНЫ (text-bg)
  // =============================================
  const textBg = figma.createRectangle();
  textBg.name = "text-bg";
  textBg.resize(master.textBgNode.width * uniformScale, master.textBgNode.height * uniformScale);
  const textBgPos = getRelativePos(master.textBgNode);
  textBg.x = textBgPos.x * uniformScale;
  textBg.y = textBgPos.y * uniformScale;
  textBg.fills = cloneFills(master.textBgNode.fills);
  artboard.appendChild(textBg);

  // =============================================
  // 4. БЕЛАЯ ПОЛОСКА ВНИЗУ (bottom-bar)
  // =============================================
  const bottomBar = figma.createRectangle();
  bottomBar.name = "bottom-bar";
  bottomBar.resize(master.bottomBarNode.width * uniformScale, master.bottomBarNode.height * uniformScale);
  const bottomBarPos = getRelativePos(master.bottomBarNode);
  bottomBar.x = bottomBarPos.x * uniformScale;
  bottomBar.y = bottomBarPos.y * uniformScale;
  bottomBar.fills = cloneFills(master.bottomBarNode.fills);
  artboard.appendChild(bottomBar);

  // =============================================
  // 5. ЛОГОТИП (logo) — клоним и МАСШТАБИРУЕМ (rescale)
  // =============================================
  const logo = master.logoNode.clone();
  logo.name = "logo";
  artboard.appendChild(logo);
  logo.rescale(uniformScale);  // Масштабирует ВСЁ включая текст!
  const logoPos = getRelativePos(master.logoNode);
  logo.x = logoPos.x * uniformScale;
  logo.y = logoPos.y * uniformScale;

  // =============================================
  // 6. HEADLINE — клоним и МАСШТАБИРУЕМ
  // =============================================
  const headline = master.headlineNode.clone();
  headline.name = "headline";
  artboard.appendChild(headline);
  headline.rescale(uniformScale);
  const headlinePos = getRelativePos(master.headlineNode);
  headline.x = headlinePos.x * uniformScale;
  headline.y = headlinePos.y * uniformScale;
  if (text && text.headline !== undefined) {
    await setTextInNode(headline, text.headline);
  }

  // =============================================
  // 7. SUBLINE — клоним и МАСШТАБИРУЕМ
  // =============================================
  const subline = master.sublineNode.clone();
  subline.name = "subline";
  artboard.appendChild(subline);
  subline.rescale(uniformScale);
  const sublinePos = getRelativePos(master.sublineNode);
  subline.x = sublinePos.x * uniformScale;
  subline.y = sublinePos.y * uniformScale;
  if (text && text.subline !== undefined) {
    await setTextInNode(subline, text.subline);
  }

  // =============================================
  // 8. DISCLAIMER — клоним и МАСШТАБИРУЕМ
  // =============================================
  const disclaimer = master.disclaimerNode.clone();
  disclaimer.name = "disclaimer";
  artboard.appendChild(disclaimer);
  disclaimer.rescale(uniformScale);
  const disclaimerPos = getRelativePos(master.disclaimerNode);
  disclaimer.x = disclaimerPos.x * uniformScale;
  disclaimer.y = disclaimerPos.y * uniformScale;
  if (text && text.disclaimer !== undefined) {
    await setTextInNode(disclaimer, text.disclaimer);
  }

  // =============================================
  // 9. GO-LOGO — клоним и МАСШТАБИРУЕМ
  // =============================================
  const goLogo = master.goLogoNode.clone();
  goLogo.name = "go-logo";
  artboard.appendChild(goLogo);
  goLogo.rescale(uniformScale);
  const goLogoPos = getRelativePos(master.goLogoNode);
  goLogo.x = goLogoPos.x * uniformScale;
  goLogo.y = goLogoPos.y * uniformScale;

  // =============================================
  // 10. РАМКА (если есть по ТТ)
  // =============================================
  if (specs.has_frame) {
    const frameRect = figma.createRectangle();
    frameRect.name = "frame";
    frameRect.resize(totalW, totalH);
    frameRect.x = 0;
    frameRect.y = 0;
    frameRect.fills = [];
    frameRect.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    frameRect.strokeWeight = 2;
    frameRect.strokeAlign = "INSIDE";
    artboard.appendChild(frameRect);
  }

  return artboard;
}

async function setTextInNode(node: SceneNode, value: string): Promise<void> {
  const textNode = findFirstTextNode(node);
  if (!textNode) return;
  if (textNode.fontName === figma.mixed) {
    const len = textNode.characters.length;
    const fonts = textNode.getRangeAllFontNames(0, len);
    await Promise.all(fonts.map((font) => figma.loadFontAsync(font)));
  } else {
    await figma.loadFontAsync(textNode.fontName as FontName);
  }
  textNode.characters = value;
}
