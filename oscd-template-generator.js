import { css, html, LitElement } from 'https://unpkg.com/lit?module';

import 'https://unpkg.com/@material/mwc-fab?module';

import 'https://unpkg.com/@openscd/oscd-tree-grid?module';

import { generateTemplates } from './generate-templates.js';

const tree = await fetch(new URL('./tree.json', import.meta.url))
  .then(res => res.json());

let lastSelection = {};
let lastFilter = '';

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

export function getDTTReference(parent, tag) {
  const children = Array.from(parent.children);

  const sequence = ['LNodeType', 'DOType', 'DAType', 'EnumType'];
  let index = sequence.findIndex(element => element === tag);

  if (index < 0) return null;

  let nextSibling;
  while (index < sequence.length && !nextSibling) {
    nextSibling = children.find(child => child.tagName === sequence[index]);
    index++;
  }

  return nextSibling ?? null;
}

function download(filename, text, mimeType = 'text/json') {
  const pom = document.createElement('a');
  pom.setAttribute('href', `data:${mimeType};charset=utf-8,${encodeURIComponent(text)}`);
  pom.setAttribute('download', filename);

  if (document.createEvent) {
    const event = document.createEvent('MouseEvents');
    event.initEvent('click', true, true);
    pom.dispatchEvent(event);
  }
  else {
    pom.click();
  }
}

export default class OscdTemplateGenerator extends LitElement {
  get selection() {
    return this.treeUI.selection;
  }

  set selection(s) {
    this.treeUI.selection = s;
  }

  get filter() {
    return this.treeUI.filter;
  }

  set filter(f) {
    this.treeUI.filter = f;
  }

  saveSelection() {
    download(Object.keys(this.selection).join('_') + '_selection.json',
      JSON.stringify(this.selection));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    lastSelection = this.selection;
    lastFilter = this.filter;
  }

  async loadSelection(event) {
    var _a, _b, _d;
    const file = (_d = (_b = (_a = event.target) === null || _a === void 0 ? void 0 : _a.files) === null || _b === void 0 ? void 0 : _b.item(0)) !== null && _d !== void 0 ? _d : false;
    if (!file)
      return;
    this.treeUI.selection = JSON.parse(await file.text());
    this.treeUI.searchUI.value = this.treeUI.depth ? ' ' : '';
    this.treeUI.collapsed = new Set();
    this.shadowRoot.querySelector('input').onchange = null;
  }

  render() {
    if (!this.doc) return html``;
    return html`
      <div><oscd-tree-grid multi></oscd-tree-grid></div>
      <form>
        <button @click=${() => this.saveSelection()}>Download Selection</button></br>
        <label for="selection-input">Load selection</label><br>
        <input @click=${(event) => { event.target.value = ''; }}
        @change=${event => this.loadSelection(event)} accept=".json" type="file">
        </input>
      </form>
      <mwc-fab extended icon="add" label="Add Types" @click=${() => this.saveTemplates()}></mwc-fab>`;
  }

  get treeUI() {
    return  this.shadowRoot.querySelector('oscd-tree-grid');
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
        newActionEvent({new: {parent: this.doc.documentElement, element: templates, reference: null }}));
      this.dispatchEvent(
        newEditEvent({parent: this.doc.documentElement, node: templates}));
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
        const reference = getDTTReference(templates, element.tagName);
        this.dispatchEvent(newActionEvent({new: {parent: templates, element, reference }}));
        this.dispatchEvent(newEditEvent({parent: templates, node: element, reference }));
      }
    });

  }

  async firstUpdated() {
    this.treeUI.tree = tree;
    await this.treeUI.updateComplete;
    this.filter = lastFilter;
    this.selection = lastSelection;
  }

  static properties = {
    doc: {attribute: false},
    selection: {type: Object, reflect: true},
    filter: {type: String, reflect: true}
  };

  static styles = css`
div {
  margin: 12px;
}
mwc-fab {
  position: fixed;
  bottom: 32px;
  right: 32px;
}
form {
  opacity: 0.1;
}
form:hover, form:focus-within, form:focus {
  opacity: 1;
}
`;
}
