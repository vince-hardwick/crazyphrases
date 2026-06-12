export async function writePlainText(
  text,
  { documentRef = globalThis.document, navigatorRef = globalThis.navigator } = {},
) {
  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(text);
      return true;
    } catch {
      return copyWithTemporaryTextarea(text, documentRef);
    }
  }

  return copyWithTemporaryTextarea(text, documentRef);
}

function copyWithTemporaryTextarea(text, documentRef) {
  if (
    (!documentRef?.body?.append && !documentRef?.body?.appendChild) ||
    !documentRef?.createElement ||
    typeof documentRef.execCommand !== "function"
  ) {
    return false;
  }

  const textarea = documentRef.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute?.("readonly", "");
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.position = "fixed";
  textarea.style.top = "0";

  if (documentRef.body.append) {
    documentRef.body.append(textarea);
  } else {
    documentRef.body.appendChild(textarea);
  }
  textarea.focus?.();
  textarea.select();
  textarea.setSelectionRange?.(0, textarea.value.length);

  try {
    return documentRef.execCommand("copy") === true;
  } finally {
    textarea.remove();
  }
}
