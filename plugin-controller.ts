import { readMaster, generateAdArtboard, MasterData } from "./services/layout-engine";
import { getTextFromNode, findImageFill } from "./utils/figma-helpers";

let currentMaster: MasterData | null = null;

figma.showUI(__html__, { width: 360, height: 540 });

figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {

    case "READ_MASTER": {
      try {
        currentMaster = await readMaster();
        figma.ui.postMessage({
          type: "MASTER_LOADED",
          data: {
            headlineText: getTextFromNode(currentMaster.headlineNode),
            sublineText: getTextFromNode(currentMaster.sublineNode),
            disclaimerText: getTextFromNode(currentMaster.disclaimerNode),
          },
        });
      } catch (e: any) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }

    case "GENERATE": {
      if (!currentMaster) {
        figma.ui.postMessage({ type: "ERROR", message: "Сначала загрузите мастер" });
        break;
      }
      try {
        const artboard = await generateAdArtboard(currentMaster, msg.specs, msg.layout, msg.text);
        // Ставим справа от мастера
        artboard.x = currentMaster.frame.x + currentMaster.frame.width + 100;
        artboard.y = currentMaster.frame.y;
        figma.currentPage.appendChild(artboard);
        figma.currentPage.selection = [artboard];
        figma.viewport.scrollAndZoomIntoView([artboard]);
        figma.ui.postMessage({ type: "GENERATED", name: artboard.name });
      } catch (e: any) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }

    case "READ_TT_IMAGE": {
      try {
        const selected = figma.currentPage.selection[0];
        if (!selected) throw new Error("Выделите изображение ТТ в Figma");
        const imageHash = findImageFill(selected as SceneNode);
        if (!imageHash) throw new Error("В выделенном слое не найдено изображение");
        const image = figma.getImageByHash(imageHash);
        if (!image) throw new Error("Не удалось получить изображение из Figma");
        const imageBytes = await image.getBytesAsync();
        figma.ui.postMessage({ type: "TT_IMAGE_DATA", imageBytes });
      } catch (e: any) {
        figma.ui.postMessage({ type: "ERROR", message: e.message });
      }
      break;
    }

    case "CLOSE":
      figma.closePlugin();
      break;
  }
};
