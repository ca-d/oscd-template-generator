import { html } from 'lit';
import { fixture, expect } from '@open-wc/testing';
import { restore, fake, SinonSpy } from 'sinon';

import { ListItem } from '@material/mwc-list/mwc-list-item.js';

import TemplateGenerator from './oscd-template-generator.js';

customElements.define('template-generator', TemplateGenerator);

export const sclDocString = `<?xml version="1.0" encoding="UTF-8"?>
<SCL version="2007" revision="B" xmlns="http://www.iec.ch/61850/2003/SCL">
  <DataTypeTemplates></DataTypeTemplates>
</SCL>`;

describe('TemplateGenerator', () => {
  let element: TemplateGenerator;
  beforeEach(async () => {
    element = await fixture(html`<template-generator></template-generator>`);
  });

  it('displays no action button', () =>
    expect(element.shadowRoot?.querySelector('mwc-fab')).to.not.exist);

  it('starts with LPHD selected', () => {
    expect(element).to.have.property('lNodeType', 'LPHD');
    expect(element).shadowDom.to.equalSnapshot();
  });

  describe('given a loaded document', () => {
    let listener: SinonSpy;
    afterEach(restore);
    beforeEach(async () => {
      listener = fake();
      element.addEventListener('oscd-edit', listener);
      element.doc = new DOMParser().parseFromString(
        sclDocString,
        'application/xml'
      );
      await element.updateComplete;
    });

    it('displays an action button', () =>
      expect(element.shadowRoot?.querySelector('mwc-fab')).to.exist);

    it('adds Templates on action button click', () => {
      element.shadowRoot?.querySelector('mwc-fab')?.click();

      /* expect five calls for
         - LPHD and its mandatory DOTypes
           - PhyHealth and its mandatory EnumType
             - stVal
           - PhyNam
           - Proxy
       */
      expect(listener).property('args').to.have.lengthOf(5);
      listener.args.forEach(args => {
        expect(args[0])
          .property('detail')
          .to.have.property(
            'parent',
            element.doc?.querySelector('DataTypeTemplates')
          );
        expect(args[0]).property('detail').to.have.property('node');
      });
    });

    it('adds missing DataTypeTemplates section on action button click', () => {
      element.doc?.querySelector('DataTypeTemplates')?.remove();
      element.shadowRoot?.querySelector('mwc-fab')?.click();

      // expect one more call for the DTT section
      expect(listener).property('args').to.have.lengthOf(6);
      expect(listener.args[0][0])
        .property('detail')
        .to.have.property('parent', element.doc?.documentElement);
      expect(listener.args[0][0])
        .property('detail')
        .property('node')
        .to.have.property('tagName', 'DataTypeTemplates');
    });

    it('adds LNodeTypes, DOTypes, DATypes, and EnumTypes as requested', async () => {
      element.lNodeType = 'LLN0';
      await element.lNodeTypeUI?.updateComplete;
      await element.updateComplete;

      async function selectAll(column: number) {
        const item = element.treeUI.shadowRoot?.querySelector<ListItem>(
          `mwc-list:nth-of-type(${column + 1}) > mwc-list-item:first-of-type`
        );
        item?.click();
        await element.treeUI.updateComplete;
        await element.updateComplete;
      }

      await selectAll(1);
      await selectAll(2);
      await selectAll(3);
      await selectAll(4);
      await selectAll(5);

      element.shadowRoot?.querySelector('mwc-fab')?.click();

      /* expect 30 calls for
        LNodeType LLN0
        DOType    Beh
                  Diag
                  GrRef
                  Health
                  InRef
                  LEDRs
                  Loc
                  LocKey
                  LocSta
                  MltLev
                  Mod
                  NamPlt
                  SwModKey
        DAType    origin
                  pulseConfig
                  SBOw
                  Oper
                  Cancel
                  SBOw
                  Oper
                  Cancel
        EnumType  stVal
                  subVal
                  orCat
                  cmdQual
                  ctlModel
                  sboClass
                  stVal
                  subVal
       */
      expect(listener).property('args').to.have.lengthOf(30);
      const elms = listener.args.map(args => args[0].detail.node);
      expect(elms.filter(e => e.tagName === 'LNodeType')).to.have.lengthOf(1);
      expect(elms.filter(e => e.tagName === 'DOType')).to.have.lengthOf(13);
      expect(elms.filter(e => e.tagName === 'DAType')).to.have.lengthOf(8);
      expect(elms.filter(e => e.tagName === 'EnumType')).to.have.lengthOf(8);
    }).timeout(10000); // selecting 550 paths for a full LLN0 is rather slow.
  });
});
