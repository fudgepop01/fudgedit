import { Component, Element } from '@stencil/core';

// From http://stackoverflow.com/a/4399718/843621
const getTextNodesIn = (node: HTMLElement, includeWhitespaceNodes: boolean = false) => {
  const textNodes: Text[] = [], nonWhitespaceMatcher = /\S/;

  const getTextNodes = (node: ChildNode) => {
    if (node.nodeType === 3) {
      if (includeWhitespaceNodes || nonWhitespaceMatcher.test(node.nodeValue)) {
        textNodes.push(node as Text);
      }
    } else if (!((node as HTMLElement).tagName == "SCRIPT" || (node as HTMLElement).hasAttribute("no-bionic"))) {
      for (let i = 0, end = node.childNodes.length; i < end; i++) {
        getTextNodes(node.childNodes[i]);
      }
    }
  }

  getTextNodes(node);
  return textNodes;
}

@Component({
  tag: 'to-bionic',
  styleUrl: 'bionic-text.css',
  shadow: false
})
export class BionicText {
  @Element() element: HTMLElement;

  formatContent() {
    const textNodes = getTextNodesIn(this.element);

    for (const textNode of textNodes) {
      const content = textNode.data;
      const splitted = content.split(/(\s+)/g);
      
      const whitespaceIdx = ((/\s+/).test(splitted[0])) ? 0 : 1;
      const replacement: ChildNode[] = [];
      for (const [idx, split] of splitted.entries()) {
        if (idx % 2 == whitespaceIdx) {
          replacement.push(document.createTextNode(split));
          continue;
        }

        const start = split.substring(0, Math.ceil(split.length / 2));
        const end = split.substring(start.length);

        
        const embold = document.createElement("span");
        embold.setAttribute("bold", "");
        embold.innerText = start;
        replacement.push(embold);

        if (end.length) {
          const regular = document.createElement("span");
          regular.setAttribute("normal", "");
          regular.innerText = end;
          replacement.push(regular);
        }
      }
      textNode.replaceWith(...replacement);
    }
  }

  render() {
    this.formatContent();
  } 
}