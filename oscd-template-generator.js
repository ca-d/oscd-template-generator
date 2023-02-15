import { css, html, LitElement } from 'https://unpkg.com/lit?module';

import 'https://unpkg.com/@openscd/oscd-tree-explorer?module';

import { generateTemplates } from './generate-templates.js';

function newEditEvent(edit) {
  return new CustomEvent('oscd-edit', {
    composed: true,
    bubbles: true,
    detail: edit
  });
}

function newActionEvent(action, eventInitDict) {
  return new CustomEvent("editor-action", {
    bubbles: true,
    composed: true,
    ...eventInitDict,
    detail: {action, ...eventInitDict?.detail}
  });
}

export default class OscdTemplateGenerator extends LitElement {
  get selection() {
    return this.treeUI.selection;
  }

  set selection(s) {
    this.treeUI.selection = s;
  }

  render() {
    return html`<div><oscd-tree-explorer multi></oscd-tree-explorer></div>
      <mwc-fab extended icon="add" label="Add Types" @click=${() => this.saveTemplates()}></mwc-fab>`;
  }

  get treeUI() {
    return  this.shadowRoot.querySelector('oscd-tree-explorer');
  }

  saveTemplates() {
    if (!this.doc) return;

    const templates = this.doc.querySelector(':root > DataTypeTemplates')|| new DOMParser()
      .parseFromString(
        `<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
                    <DataTypeTemplates></DataTypeTemplates>
              </SCL>`,
        'application/xml'
      )
      .querySelector('DataTypeTemplates');

    if (templates.ownerDocument !== this.doc) {
      this.dispatchEvent(
        newActionEvent({new: {parent: this.doc.rootElement, element: templates, reference: null }}));
      this.dispatchEvent(
        newEditEvent({parent: this.doc.rootElement, node: templates}));
    }

    delete this.treeUI.selection[""]; // workaround for UI bug
    const { enumTypes, daTypes, doTypes, lnTypes } = generateTemplates(
      this.treeUI.selection,
      templates.ownerDocument,
      this.treeUI.tree
    );

    [...lnTypes, ...doTypes, ...daTypes, ...enumTypes].forEach(element => {
      if (!this.doc.querySelector(`${element.tagName}[id="${element.id}"]`)) {
        element.setAttribute('desc', JSON.stringify(this.selection[element.id.split('$')[0]]));
        const reference = templates.querySelector(`${element.tagName}:last-of-type`)?.nextSibling ?? null
        this.dispatchEvent(newActionEvent({new: {parent: templates, element, reference }}));
        this.dispatchEvent(newEditEvent({parent: templates, node: element, reference }));
      }
    });

  }

  async firstUpdated() {
    const tree = await fetch(new URL('./tree.json', import.meta.url))
      .then(res => res.json());
    this.treeUI.tree = tree;
    import('https://unpkg.com/@material/mwc-fab?module');
  }

  static get properties() {
    return {selection: {type: Object, reflect: true}};
  }

  static styles = css`
div {
  margin: 12px;
}
mwc-fab {
    position: fixed;
    bottom: 32px;
    right: 32px;
}
`;
}
