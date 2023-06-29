import { html } from 'lit';
import { fixture, expect } from '@open-wc/testing';

import TemplateGenerator from './oscd-template-generator.js';

customElements.define('oscd-template-generator', TemplateGenerator);

describe('TemplateGenerator', () => {
  let element: TemplateGenerator;
  beforeEach(async () => {
    element = await fixture(
      html`<oscd-template-generator></oscd-template-generator>`
    );
  });

  it('exists', () => expect(element).to.exist);
});
