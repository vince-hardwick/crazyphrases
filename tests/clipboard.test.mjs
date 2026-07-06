import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { writePlainText } from "../assets/clipboard.js";

describe("clipboard writing", () => {
  it("falls back to a temporary textarea when the Clipboard API is unavailable", async () => {
    const documentRef = createClipboardFallbackDocument();

    const copied = await writePlainText("Brisk teapot ladder", {
      documentRef,
      navigatorRef: {},
    });

    const textarea = documentRef.createdElements[0];

    assert.equal(copied, true);
    assert.equal(textarea.value, "Brisk teapot ladder");
    assert.equal(textarea.readOnly, true);
    assert.equal(textarea.className, "clipboard-fallback-textarea");
    assert.deepEqual(textarea.style, {});
    assert.equal(textarea.focused, true);
    assert.equal(textarea.selected, true);
    assert.deepEqual(textarea.selectionRange, [0, "Brisk teapot ladder".length]);
    assert.equal(textarea.removed, true);
    assert.deepEqual(documentRef.commands, ["copy"]);
  });

  it("falls back to a temporary textarea when the Clipboard API rejects", async () => {
    const documentRef = createClipboardFallbackDocument();

    const copied = await writePlainText("Curious biscuit moon", {
      documentRef,
      navigatorRef: {
        clipboard: {
          async writeText() {
            throw new Error("Clipboard blocked.");
          },
        },
      },
    });

    assert.equal(copied, true);
    assert.equal(documentRef.createdElements[0].value, "Curious biscuit moon");
    assert.deepEqual(documentRef.commands, ["copy"]);
  });

  it("reports failure when no plaintext copy mechanism is available", async () => {
    const copied = await writePlainText("Sunny rocket blanket", {
      documentRef: {},
      navigatorRef: {},
    });

    assert.equal(copied, false);
  });
});

function createClipboardFallbackDocument() {
  const documentRef = {
    commands: [],
    createdElements: [],
    body: {
      append(element) {
        documentRef.appendedElement = element;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "textarea");

      const element = {
        className: "",
        focused: false,
        readOnly: false,
        removed: false,
        selectionRange: null,
        selected: false,
        style: {},
        value: "",
        focus() {
          this.focused = true;
        },
        remove() {
          this.removed = true;
        },
        select() {
          this.selected = true;
        },
        setSelectionRange(start, end) {
          this.selectionRange = [start, end];
        },
      };

      documentRef.createdElements.push(element);
      return element;
    },
    execCommand(command) {
      this.commands.push(command);
      return true;
    },
  };

  return documentRef;
}
