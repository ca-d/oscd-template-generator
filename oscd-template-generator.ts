/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-plusplus */
/* eslint-disable no-loop-func */
/* eslint-disable no-nested-ternary */
import { LitElement, html, css } from 'lit';
import { state, query } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import { newEditEvent } from '@openscd/open-scd-core';

import type { Select } from '@material/mwc-select';
import type { TreeGrid, TreeSelection } from '@openscd/oscd-tree-grid';

import '@material/mwc-fab';
import '@material/mwc-select';
import '@material/mwc-list/mwc-list-item.js';
import '@openscd/oscd-tree-grid';

import { generateTemplates } from './generate-templates.js';

// open-scd editor action for backwards compatibility
function newCreateEvent(parent: Node, element: Node, reference?: Node | null) {
  return new CustomEvent('editor-action', {
    bubbles: true,
    composed: true,
    detail: { action: { new: { parent, element, reference } } },
  });
}

const tree = await fetch(new URL('./tree.json', import.meta.url)).then(res =>
  res.json()
);

let lastLNodeType = 'LPHD';
let lastSelection = {};
let lastFilter = '';

const dataTypeTemplates = new DOMParser()
  .parseFromString(
    `<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
            <DataTypeTemplates></DataTypeTemplates>
          </SCL>`,
    'application/xml'
  )
  .querySelector('DataTypeTemplates')!;

function getDTTReference(parent: Element, tag: string) {
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

export default class TemplateGenerator extends LitElement {
  @state()
  doc?: XMLDocument;

  @query('oscd-tree-grid')
  treeUI!: TreeGrid;

  @state()
  get selection(): TreeSelection {
    return this.treeUI.selection;
  }

  set selection(selection: TreeSelection) {
    this.treeUI.selection = selection;
  }

  @state()
  get filter(): string {
    return this.treeUI.filter ?? '';
  }

  set filter(filter: string) {
    this.treeUI.filter = filter;
  }

  @query('mwc-select')
  lNodeTypeUI?: Select;

  @state()
  get lNodeType(): string {
    return this.lNodeTypeUI?.value || lastLNodeType;
  }

  set lNodeType(lNodeType: string) {
    if (!this.lNodeTypeUI) return;
    this.lNodeTypeUI.value = lNodeType;
    if (!this.lNodeTypeUI.value) this.lNodeTypeUI.value = lastLNodeType;
  }

  @state()
  addedLNode = '';

  disconnectedCallback() {
    super.disconnectedCallback();
    lastSelection = this.selection;
    lastFilter = this.filter;
    lastLNodeType = this.lNodeType;
  }

  async firstUpdated() {
    await this.treeUI.updateComplete;
    await this.lNodeTypeUI!.updateComplete;
    this.treeUI.tree = tree[lastLNodeType].children;
    this.lNodeType = lastLNodeType;
    this.filter = lastFilter;
    await this.treeUI.updateComplete;
    this.selection = lastSelection;
  }

  saveTemplates() {
    if (!this.doc) return;

    const templates =
      this.doc.querySelector(':root > DataTypeTemplates') ||
      (dataTypeTemplates.cloneNode() as Element);

    if (templates.ownerDocument !== this.doc) {
      this.dispatchEvent(
        newEditEvent({ parent: this.doc.documentElement, node: templates })
      );
      this.dispatchEvent(newCreateEvent(this.doc.documentElement, templates));
    }

    // delete this.treeUI.selection['']; // workaround for UI bug
    const { EnumType, DAType, DOType, LNodeType } = generateTemplates(
      this.treeUI.selection,
      templates.ownerDocument!,
      this.treeUI.tree,
      this.lNodeType
    );

    [...LNodeType, ...DOType, ...DAType, ...EnumType].forEach(element => {
      if (!this.doc?.querySelector(`${element.tagName}[id="${element.id}"]`)) {
        const reference = getDTTReference(templates, element.tagName);
        this.dispatchEvent(
          newEditEvent({ parent: templates, node: element, reference })
        );
        this.dispatchEvent(newCreateEvent(templates, element, reference));
      }
    });

    if (LNodeType.length) this.addedLNode = LNodeType[0].id ?? '';
  }

  reset() {
    this.addedLNode = '';
    this.treeUI.tree = tree[this.lNodeType].children;
    this.selection = {};
    this.filter = '';
    this.requestUpdate();
    this.treeUI.requestUpdate();
  }

  render() {
    return html`<div>
        <mwc-select @selected=${() => this.reset()}>
          ${Object.keys(tree).map(
            lNodeType =>
              html`<mwc-list-item value=${lNodeType}
                >${lNodeType}</mwc-list-item
              >`
          )}
        </mwc-select>
        <oscd-tree-grid></oscd-tree-grid>
      </div>
      ${this.doc
        ? html`<mwc-fab
            extended
            icon="${this.addedLNode ? 'done' : 'add'}"
            label="${this.addedLNode || 'Add Type'}"
            ?showIconAtEnd=${this.addedLNode}
            @click=${() => this.saveTemplates()}
          ></mwc-fab>`
        : html``}`;
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

    mwc-select {
      position: absolute;
      left: 300px;
    }
  `;
}
