function copyComputedStyles(source: Element, target: Element): void {
  if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
    return;
  }

  const computed = window.getComputedStyle(source);
  const cssText = Array.from(computed)
    .map((property) => `${property}:${computed.getPropertyValue(property)};`)
    .join("");
  target.setAttribute("style", cssText);
}

function cloneNodeWithInlineStyles(node: HTMLElement): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement;
  const sourceElements = [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))];
  const targetElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];

  sourceElements.forEach((sourceElement, index) => {
    const targetElement = targetElements[index];
    if (!targetElement) return;
    copyComputedStyles(sourceElement, targetElement);
  });

  return clone;
}

async function svgNodeToPngDataUrl(svgMarkup: string, width: number, height: number): Promise<string> {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Failed to load serialized screenshot image"));
      nextImage.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable");
    }
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureElementScreenshot(element: HTMLElement): Promise<{
  imageDataUrl: string;
  width: number;
  height: number;
}> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  const clone = cloneNodeWithInlineStyles(element);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;

  const imageDataUrl = await svgNodeToPngDataUrl(svgMarkup, width, height);
  return { imageDataUrl, width, height };
}
