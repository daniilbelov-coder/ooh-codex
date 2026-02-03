// Утилита: вытащить текст из компонента (ищет первый TextNode внутри)
export function getTextFromNode(node: SceneNode): string {
  if (node.type === "TEXT") return (node as TextNode).characters;
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      const text = getTextFromNode(child as SceneNode);
      if (text) return text;
    }
  }
  return "";
}

// Находит первый TextNode внутри ноды
export function findFirstTextNode(node: SceneNode): TextNode | null {
  if (node.type === "TEXT") return node as TextNode;
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      const found = findFirstTextNode(child as SceneNode);
      if (found) return found;
    }
  }
  return null;
}

// Рекурсивно ищем Rectangle с IMAGE fill внутри ноды
export function findImageFill(node: SceneNode): string | null {
  if (node.type === "RECTANGLE") {
    const fills = (node as RectangleNode).fills;
    if (Array.isArray(fills)) {
      for (const fill of fills) {
        if (fill.type === "IMAGE") return (fill as ImagePaint).imageHash;
      }
    }
  }
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      const found = findImageFill(child as SceneNode);
      if (found) return found;
    }
  }
  return null;
}

// Ищем Rectangle с IMAGE fill и возвращаем hash + transform
export function getImageTransform(node: SceneNode): { imageHash: string | null; imageTransform: Transform | null } {
  if (node.type === "RECTANGLE") {
    const fills = (node as RectangleNode).fills;
    if (Array.isArray(fills)) {
      for (const fill of fills) {
        if (fill.type === "IMAGE") {
          const imagePaint = fill as ImagePaint;
          return {
            imageHash: imagePaint.imageHash,
            imageTransform: imagePaint.imageTransform || null,
          };
        }
      }
    }
  }
  if ("children" in node) {
    for (const child of (node as ChildrenMixin).children) {
      const found = getImageTransform(child as SceneNode);
      if (found.imageHash) return found;
    }
  }
  return { imageHash: null, imageTransform: null };
}

// Глубокое копирование fills (JSON parse/stringify)
export function cloneFills(fills: readonly Paint[] | PluginAPI["mixed"]): Paint[] {
  if (fills === figma.mixed || !Array.isArray(fills)) return [];
  return JSON.parse(JSON.stringify(fills));
}
