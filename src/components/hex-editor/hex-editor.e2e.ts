import { newE2EPage } from '@stencil/core/testing';

describe('fudge-hex-editor', () => {
  it('renders', async () => {
    const page = await newE2EPage();

    await page.setContent('<fudge-hex-editor></fudge-hex-editor>');
    const element = await page.find('fudge-hex-editor');
    expect(element).toHaveClass('hydrated');
  });
});
