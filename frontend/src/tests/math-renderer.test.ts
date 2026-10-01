import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { preprocessLaTeX, chatMarkdownComponents } from '../utils/mathRenderer.ts';

describe('CredVidhi AI Chat Math & Markdown Renderer', () => {
  it('correctly normalizes and typesets the deterministic EMI formula as KaTeX display math', () => {
    const rawAiResponse =
      'We use the deterministic standard compound interest amortization formula:\n\n' +
      '$$\\text{EMI} = \\frac{P \\times r \\times (1 + r)^n}{(1 + r)^n - 1}$$\n\n' +
      '- **P:** Principal loan amount';

    const processed = preprocessLaTeX(rawAiResponse);

    // Verify preprocessing ensures clean block delimiters
    assert.match(processed, /\$\$\n\\text\{EMI\}/);

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        processed
      )
    );

    // Assert KaTeX math elements are present
    assert.ok(html.includes('class="katex-display"'), 'Expected display math block');
    assert.ok(html.includes('class="katex"'), 'Expected KaTeX rendered structure');
    assert.ok(html.includes('class="mfrac"'), 'Expected fraction element in KaTeX HTML');
    assert.ok(!html.includes('$$\\text{EMI}'), 'Raw LaTeX $$ must not appear in output HTML');
  });

  it('handles double-escaped LaTeX backslashes without corrupting math structure', () => {
    const rawAiResponse = '$$\\\\text{EMI} = \\\\frac{P \\\\times r \\\\times (1 + r)^n}{(1 + r)^n - 1}$$';
    const processed = preprocessLaTeX(rawAiResponse);

    assert.ok(!processed.includes('\\\\text'), 'Double-escaped \\\\text should be normalized to \\text');
    assert.ok(!processed.includes('\\\\frac'), 'Double-escaped \\\\frac should be normalized to \\frac');

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        processed
      )
    );

    assert.ok(html.includes('class="katex-display"'));
    assert.ok(!html.includes('newline'), 'Double backslash should not create unwanted KaTeX newlines');
  });

  it('renders inline math expressions correctly without breaking surrounding text', () => {
    const raw = 'Monthly interest rate $r = \\text{Annual Rate} / 12 / 100$ and principal $P$.';
    const processed = preprocessLaTeX(raw);

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        processed
      )
    );

    assert.ok(html.includes('class="katex"'), 'KaTeX inline math should render');
    assert.ok(!html.includes('class="katex-display"'), 'Inline math must not render as block math');
    assert.ok(!html.includes('$r ='), 'Raw inline $ delimiter must be parsed into KaTeX');
  });

  it('shields currency amounts from accidental math parsing and handles pre-escaped currency', () => {
    const raw = 'The loan amount ranges between $500 and $1,000, or \\$2,500 pre-escaped.';
    const processed = preprocessLaTeX(raw);

    assert.ok(!processed.includes('\\\\$2,500'), 'Pre-escaped currency must not be double-escaped');

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        processed
      )
    );

    assert.ok(!html.includes('class="katex"'), 'Currency amounts must not trigger math rendering');
    assert.ok(html.includes('$500'), 'Currency figure $500 must stay readable');
    assert.ok(html.includes('$1,000'), 'Currency figure $1,000 must stay readable');
    assert.ok(html.includes('$2,500'), 'Pre-escaped figure $2,500 must render cleanly');
  });

  it('renders alternative LaTeX delimiters \\[...\\] and \\(...\\)', () => {
    const raw = 'Block: \\[ A = \\pi r^2 \\] and inline: \\( a^2 + b^2 = c^2 \\)';
    const processed = preprocessLaTeX(raw);

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        processed
      )
    );

    assert.ok(html.includes('class="katex-display"'), 'Display delimiter should render block math');
    assert.ok(html.includes('class="katex"'), 'Inline delimiter should render inline math');
  });

  it('preserves rich markdown elements (headings, bold, lists, code, links)', () => {
    const markdown =
      '### Formula Overview\n\n' +
      'Here is **bold info** and *italic info* with `code block`.\n\n' +
      '- Bullet 1\n' +
      '- Bullet 2\n\n' +
      '1. Step 1\n' +
      '2. Step 2\n\n' +
      '[CredVidhi](https://credvidhi.in)';

    const html = renderToString(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
          components: chatMarkdownComponents,
        },
        markdown
      )
    );

    assert.ok(html.includes('<h4'), 'Expected h4 for ### heading');
    assert.ok(html.includes('bold info</strong>') && html.includes('<strong class="font-semibold'), 'Expected styled strong tag');
    assert.ok(html.includes('<em class="italic">italic info</em>'), 'Expected italic em tag');
    assert.ok(html.includes('<ul'), 'Expected ul tag');
    assert.ok(html.includes('<ol'), 'Expected ol tag');
    assert.ok(html.includes('href="https://credvidhi.in"'), 'Expected link');
  });

  it('does not throw on incomplete streamed math expressions', () => {
    const incomplete = 'Calculating EMI: $$\\text{EMI} = \\frac{P \\times r';
    const processed = preprocessLaTeX(incomplete);

    assert.doesNotThrow(() => {
      renderToString(
        React.createElement(
          ReactMarkdown,
          {
            remarkPlugins: [remarkMath],
            rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
            components: chatMarkdownComponents,
          },
          processed
        )
      );
    });
  });
});
