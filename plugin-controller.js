"use strict";
(() => {
  // utils/unit-converter.ts
  function cmToPx(cm, dpi) {
    return Math.round(cm / 2.54 * dpi);
  }

  // utils/figma-helpers.ts
  function getTextFromNode(node) {
    if (node.type === "TEXT")
      return node.characters;
    if ("children" in node) {
      for (const child of node.children) {
        const text = getTextFromNode(child);
        if (text)
          return text;
      }
    }
    return "";
  }
  function getImageTransform(node) {
    if (node.type === "RECTANGLE") {
      const fills = node.fills;
      if (Array.isArray(fills)) {
        for (const fill of fills) {
          if (fill.type === "IMAGE") {
            const imagePaint = fill;
            return {
              imageHash: imagePaint.imageHash,
              imageTransform: imagePaint.imageTransform || null
            };
          }
        }
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        const found = getImageTransform(child);
        if (found.imageHash)
          return found;
      }
    }
    return { imageHash: null, imageTransform: null };
  }
  function cloneFills(fills) {
    if (fills === figma.mixed || !Array.isArray(fills))
      return [];
    return JSON.parse(JSON.stringify(fills));
  }

  // services/layout-engine.ts
  async function readMaster() {
    const selected = figma.currentPage.selection[0];
    if (!selected || selected.type !== "FRAME" || selected.name !== "master") {
      throw new Error('\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0430\u0440\u0442\u0431\u043E\u0440\u0434 "master" \u0432 Figma');
    }
    const frame = selected;
    const photoComponent = frame.findOne((n) => n.name === "photo");
    if (!photoComponent)
      throw new Error('\u0421\u043B\u043E\u0439 "photo" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D');
    const { imageHash, imageTransform } = getImageTransform(photoComponent);
    if (!imageHash)
      throw new Error("\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 photo \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E");
    const image = figma.getImageByHash(imageHash);
    if (!image)
      throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0438\u0437 Figma");
    const imageBytes = await image.getBytesAsync();
    const logoNode = frame.findOne((n) => n.name === "logo");
    const headlineNode = frame.findOne((n) => n.name === "headline");
    const sublineNode = frame.findOne((n) => n.name === "subline");
    const disclaimerNode = frame.findOne((n) => n.name === "disclaimer");
    const goLogoNode = frame.findOne((n) => n.name === "go-logo");
    const textZoneNode = frame.findOne((n) => n.name === "text-zone");
    const textBgNode = frame.findOne((n) => n.name === "text-bg");
    const bottomBarNode = frame.findOne((n) => n.name === "bottom-bar");
    const required = {
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
      if (!node)
        throw new Error(`\u0421\u043B\u043E\u0439 "${name}" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u043C\u0430\u0441\u0442\u0435\u0440\u0435`);
    }
    return {
      frame,
      photoNode: photoComponent,
      photoImageBytes: imageBytes,
      photoImageTransform: imageTransform,
      logoNode,
      headlineNode,
      sublineNode,
      disclaimerNode,
      goLogoNode,
      textZoneNode,
      textBgNode,
      bottomBarNode
    };
  }
  async function generateAdArtboard(master, specs, layout) {
    const dpi = specs.dpi;
    const totalW = cmToPx(specs.total_width_cm, dpi);
    const totalH = cmToPx(specs.total_height_cm, dpi);
    const masterW = master.frame.width;
    const masterH = master.frame.height;
    const masterTextW = master.textBgNode.width;
    const masterPhotoW = masterW - masterTextW;
    const masterSplitRatio = masterPhotoW / masterW;
    const photoW = Math.round(totalW * masterSplitRatio);
    const textW = totalW - photoW;
    const scale = totalH / masterH;
    console.log("[DEBUG] Master dimensions:", { masterW, masterH, masterTextW, masterPhotoW, masterSplitRatio });
    console.log("[DEBUG] New dimensions:", { totalW, totalH, photoW, textW, scale });
    console.log("[DEBUG] Master logo pos:", { x: master.logoNode.x, y: master.logoNode.y, w: master.logoNode.width, h: master.logoNode.height });
    console.log("[DEBUG] Master headline pos:", { x: master.headlineNode.x, y: master.headlineNode.y });
    console.log("[DEBUG] Master textBg pos:", { x: master.textBgNode.x, y: master.textBgNode.y });
    console.log("[DEBUG] Master bottomBar:", { x: master.bottomBarNode.x, y: master.bottomBarNode.y, w: master.bottomBarNode.width, h: master.bottomBarNode.height });
    const uniformScale = totalH / masterH;
    const bottomBarH = Math.round(master.bottomBarNode.height * uniformScale);
    const textZoneX = layout.text_zone === "left" ? 0 : photoW;
    const photoZoneX = layout.photo_zone === "right" ? textW : 0;
    console.log("[DEBUG] uniformScale:", uniformScale, "masterW:", masterW, "masterH:", masterH, "totalW:", totalW, "totalH:", totalH);
    const artboard = figma.createFrame();
    artboard.name = specs.name || "Ad_" + Date.now();
    artboard.resize(totalW, totalH);
    artboard.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    const masterFrameBox = master.frame.absoluteBoundingBox;
    function getRelativePos(node) {
      const box = node.absoluteBoundingBox;
      return {
        x: box.x - masterFrameBox.x,
        y: box.y - masterFrameBox.y
      };
    }
    const photoRect = figma.createRectangle();
    photoRect.name = "photo";
    photoRect.resize(master.photoNode.width * uniformScale, master.photoNode.height * uniformScale);
    const photoPos = getRelativePos(master.photoNode);
    photoRect.x = photoPos.x * uniformScale;
    photoRect.y = photoPos.y * uniformScale;
    const figmaImage = figma.createImage(master.photoImageBytes);
    photoRect.fills = [{
      type: "IMAGE",
      imageHash: figmaImage.hash,
      scaleMode: "FILL"
    }];
    artboard.appendChild(photoRect);
    const textBg = figma.createRectangle();
    textBg.name = "text-bg";
    textBg.resize(master.textBgNode.width * uniformScale, master.textBgNode.height * uniformScale);
    const textBgPos = getRelativePos(master.textBgNode);
    textBg.x = textBgPos.x * uniformScale;
    textBg.y = textBgPos.y * uniformScale;
    textBg.fills = cloneFills(master.textBgNode.fills);
    artboard.appendChild(textBg);
    const bottomBar = figma.createRectangle();
    bottomBar.name = "bottom-bar";
    bottomBar.resize(master.bottomBarNode.width * uniformScale, master.bottomBarNode.height * uniformScale);
    const bottomBarPos = getRelativePos(master.bottomBarNode);
    bottomBar.x = bottomBarPos.x * uniformScale;
    bottomBar.y = bottomBarPos.y * uniformScale;
    bottomBar.fills = cloneFills(master.bottomBarNode.fills);
    artboard.appendChild(bottomBar);
    const logo = master.logoNode.clone();
    logo.name = "logo";
    artboard.appendChild(logo);
    logo.rescale(uniformScale);
    const logoPos = getRelativePos(master.logoNode);
    logo.x = logoPos.x * uniformScale;
    logo.y = logoPos.y * uniformScale;
    const headline = master.headlineNode.clone();
    headline.name = "headline";
    artboard.appendChild(headline);
    headline.rescale(uniformScale);
    const headlinePos = getRelativePos(master.headlineNode);
    headline.x = headlinePos.x * uniformScale;
    headline.y = headlinePos.y * uniformScale;
    const subline = master.sublineNode.clone();
    subline.name = "subline";
    artboard.appendChild(subline);
    subline.rescale(uniformScale);
    const sublinePos = getRelativePos(master.sublineNode);
    subline.x = sublinePos.x * uniformScale;
    subline.y = sublinePos.y * uniformScale;
    const disclaimer = master.disclaimerNode.clone();
    disclaimer.name = "disclaimer";
    artboard.appendChild(disclaimer);
    disclaimer.rescale(uniformScale);
    const disclaimerPos = getRelativePos(master.disclaimerNode);
    disclaimer.x = disclaimerPos.x * uniformScale;
    disclaimer.y = disclaimerPos.y * uniformScale;
    const goLogo = master.goLogoNode.clone();
    goLogo.name = "go-logo";
    artboard.appendChild(goLogo);
    goLogo.rescale(uniformScale);
    const goLogoPos = getRelativePos(master.goLogoNode);
    goLogo.x = goLogoPos.x * uniformScale;
    goLogo.y = goLogoPos.y * uniformScale;
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

  // plugin-controller.ts
  var currentMaster = null;
  figma.showUI(__html__, { width: 420, height: 680 });
  figma.ui.onmessage = async (msg) => {
    switch (msg.type) {
      case "READ_MASTER": {
        try {
          currentMaster = await readMaster();
          figma.ui.postMessage({
            type: "MASTER_LOADED",
            data: {
              headlineText: getTextFromNode(currentMaster.headlineNode),
              sublineText: getTextFromNode(currentMaster.sublineNode),
              disclaimerText: getTextFromNode(currentMaster.disclaimerNode)
            }
          });
        } catch (e) {
          figma.ui.postMessage({ type: "ERROR", message: e.message });
        }
        break;
      }
      case "GENERATE": {
        if (!currentMaster) {
          figma.ui.postMessage({ type: "ERROR", message: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043C\u0430\u0441\u0442\u0435\u0440" });
          break;
        }
        try {
          const artboard = await generateAdArtboard(currentMaster, msg.specs, msg.layout);
          artboard.x = currentMaster.frame.x + currentMaster.frame.width + 100;
          artboard.y = currentMaster.frame.y;
          figma.currentPage.appendChild(artboard);
          figma.currentPage.selection = [artboard];
          figma.viewport.scrollAndZoomIntoView([artboard]);
          figma.ui.postMessage({ type: "GENERATED", name: artboard.name });
        } catch (e) {
          figma.ui.postMessage({ type: "ERROR", message: e.message });
        }
        break;
      }
      case "CLOSE":
        figma.closePlugin();
        break;
    }
  };
})();
