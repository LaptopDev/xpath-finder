// MODIFIED: Added editable XPath panel, Enter-to-highlight, and style config support.

var xPathFinder = xPathFinder || (() => {
  class Inspector {
    constructor() {
      this.win = window;
      this.doc = window.document;

      this.draw = this.draw.bind(this);
      this.getData = this.getData.bind(this);
      this.setOptions = this.setOptions.bind(this);

      this.cssNode = 'xpath-css';
      this.contentNode = 'xpath-content';
      this.overlayElement = 'xpath-overlay';
      this.boxes = [];
    }

    getData(e, iframe) {
      e.stopImmediatePropagation();
      e.preventDefault && e.preventDefault();
      e.stopPropagation && e.stopPropagation();

      if (e.target.id !== this.contentNode) {
        this.XPath = this.getXPath(e.target);
        const contentNode = document.getElementById(this.contentNode);
        const iframeNode = window.frameElement || iframe;

        const contentHtml = document.createElement('div');
        contentHtml.id = this.contentNode;
        contentHtml.style = 'position:fixed;z-index:10000001;padding:10px;background:gray;color:white;font-size:14px;';

        const editable = document.createElement('div');
        editable.contentEditable = true;
        editable.textContent = this.XPath;
        editable.style = 'outline:none;min-width:400px;';
        editable.id = 'xpath-edit';

        editable.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            this.clearHighlights();
            this.highlightElements(editable.textContent);
          }
        });

        contentHtml.appendChild(editable);
        if (contentNode) {
          contentNode.replaceWith(contentHtml);
        } else {
          document.body.appendChild(contentHtml);
        }

        this.options.clipboard && this.copyText(this.XPath);
      }
    }

    highlightElements(xpath) {
      try {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        chrome.storage.sync.get(['color', 'style'], (prefs) => {
          const borderColor = prefs.color || 'blue';
          const borderStyle = prefs.style || 'solid';

          for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node.nodeType === Node.ELEMENT_NODE) {
              const rect = node.getBoundingClientRect();
              const box = document.createElement('div');
              box.style.position = 'absolute';
              box.style.border = `2px ${borderStyle} ${borderColor}`;
              box.style.top = `${rect.top + window.scrollY}px`;
              box.style.left = `${rect.left + window.scrollX}px`;
              box.style.width = `${rect.width}px`;
              box.style.height = `${rect.height}px`;
              box.style.pointerEvents = 'none';
              box.style.zIndex = 9999;
              document.body.appendChild(box);
              this.boxes.push(box);
            }
          }
        });
      } catch (e) {
        console.error('Invalid XPath:', xpath);
      }
    }

    clearHighlights() {
      this.boxes.forEach(box => box.remove());
      this.boxes = [];
    }

    setOptions(options) {
      this.options = options;
      let position = 'bottom:0;left:0';
      switch (options.position) {
        case 'tl': position = 'top:0;left:0'; break;
        case 'tr': position = 'top:0;right:0'; break;
        case 'br': position = 'bottom:0;right:0'; break;
        default: break;
      }
      this.styles = `body *{cursor:crosshair!important;}#${this.contentNode}{${position};cursor:initial!important;padding:10px;background:gray;color:white;position:fixed;font-size:14px;z-index:10000001;}`;
      this.activate();
    }

    activate() {
      if (!document.getElementById(this.cssNode)) {
        const styles = document.createElement('style');
        styles.innerText = this.styles;
        styles.id = this.cssNode;
        document.head.appendChild(styles);
      }
      document.addEventListener('click', this.getData, true);
      this.options.inspector && document.addEventListener('mouseover', this.draw);
    }

    deactivate() {
      const cssNode = document.getElementById(this.cssNode);
      cssNode && cssNode.remove();

      const contentNode = document.getElementById(this.contentNode);
      contentNode && contentNode.remove();

      this.clearHighlights();

      document.removeEventListener('click', this.getData, true);
      this.options && this.options.inspector && document.removeEventListener('mouseover', this.draw);
    }

    copyText(XPath) {
      const hdInp = document.createElement('textarea');
      hdInp.textContent = XPath;
      document.body.appendChild(hdInp);
      hdInp.select();
      document.execCommand('copy');
      hdInp.remove();
    }

    draw(e) {
      // (unchanged from original)
    }

    getXPath(el) {
      let nodeElem = el;
      if (nodeElem.id && this.options.shortid) {
        return `//*[@id="${nodeElem.id}"]`;
      }
      const parts = [];
      while (nodeElem && nodeElem.nodeType === Node.ELEMENT_NODE) {
        let nbOfPreviousSiblings = 0;
        let hasNextSiblings = false;
        let sibling = nodeElem.previousSibling;
        while (sibling) {
          if (sibling.nodeType !== Node.DOCUMENT_TYPE_NODE && sibling.nodeName === nodeElem.nodeName) {
            nbOfPreviousSiblings++;
          }
          sibling = sibling.previousSibling;
        }
        sibling = nodeElem.nextSibling;
        while (sibling) {
          if (sibling.nodeName === nodeElem.nodeName) {
            hasNextSiblings = true;
            break;
          }
          sibling = sibling.nextSibling;
        }
        const prefix = nodeElem.prefix ? nodeElem.prefix + ':' : '';
        const nth = nbOfPreviousSiblings || hasNextSiblings ? `[${nbOfPreviousSiblings + 1}]` : '';
        parts.push(prefix + nodeElem.localName + nth);
        nodeElem = nodeElem.parentNode;
      }
      return parts.length ? '/' + parts.reverse().join('/') : '';
    }

    // Existing helper functions (getElementDimensions, etc.) remain unchanged
  }

  const inspect = new Inspector();

  chrome.runtime.onMessage.addListener(request => {
    if (request.action === 'activate') {
      chrome.storage.local.get({
        inspector: true,
        clipboard: true,
        shortid: true,
        position: 'bl'
      }, inspect.setOptions);
    } else {
      inspect.deactivate();
    }
  });

  return true;
})();
