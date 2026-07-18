import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BrandProvider } from '@/brands/BrandProvider';
import { campusMarketBrand, defaultBrand } from '@/brands';
import type { BrandTheme } from '@/brands/schema';
import { useBrand } from '@/brands/brandContext';

function ActiveBrandName() {
  return <span>{useBrand().brandName}</span>;
}

function cssVariable(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lightest = Math.max(foregroundLuminance, backgroundLuminance);
  const darkest = Math.min(foregroundLuminance, backgroundLuminance);

  return (lightest + 0.05) / (darkest + 0.05);
}

function expectReadableTheme(theme: BrandTheme) {
  const { colors } = theme;
  const pairs = [
    [colors.text.primary, colors.canvas],
    [colors.text.primary, colors.surface.default],
    [colors.text.muted, colors.canvas],
    [colors.text.muted, colors.surface.default],
    [colors.action.primary, colors.action.primaryText],
    [colors.action.primary, colors.surface.emphasized],
    [colors.action.accent, colors.surface.default],
  ];

  pairs.forEach(([foreground, background]) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
}

describe('BrandProvider', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    document.documentElement.removeAttribute('style');
  });

  it('falls back to the default theme for an unknown tenant', () => {
    vi.stubEnv('VITE_TENANT_ID', 'unknown-tenant');

    render(
      <BrandProvider>
        <ActiveBrandName />
      </BrandProvider>,
    );

    expect(screen.getByText('MercadoZetta')).toBeInTheDocument();
    expect(cssVariable('--theme-canvas')).toBe('#f5f6f8');
    expect(cssVariable('--theme-action-primary')).toBe('#1d4ed8');
    expect(cssVariable('--theme-text')).toBe('#333333');
  });

  it('exposes every semantic token from an explicit tenant theme', () => {
    render(
      <BrandProvider brand={campusMarketBrand}>
        <ActiveBrandName />
      </BrandProvider>,
    );

    expect(screen.getByText('CampusMarket')).toBeInTheDocument();
    expect(
      Object.fromEntries(
        [
          '--theme-canvas',
          '--theme-surface',
          '--theme-surface-emphasized',
          '--theme-action-primary',
          '--theme-action-primary-text',
          '--theme-action-accent',
          '--theme-text',
          '--theme-text-muted',
          '--theme-border',
          '--theme-font-body',
          '--theme-font-heading',
          '--theme-radius-control',
          '--theme-radius-surface',
          '--theme-shadow-surface',
        ].map((name) => [name, cssVariable(name)]),
      ),
    ).toEqual({
      '--theme-canvas': '#f1f5f9',
      '--theme-surface': '#f8fafc',
      '--theme-surface-emphasized': '#dff7f0',
      '--theme-action-primary': '#0f766e',
      '--theme-action-primary-text': '#ffffff',
      '--theme-action-accent': '#b45309',
      '--theme-text': '#172554',
      '--theme-text-muted': '#475569',
      '--theme-border': '#cbd5e1',
      '--theme-font-body': 'Arial, Helvetica, sans-serif',
      '--theme-font-heading': 'Arial, Helvetica, sans-serif',
      '--theme-radius-control': '0.375rem',
      '--theme-radius-surface': '0.5rem',
      '--theme-shadow-surface': '0 1px 3px rgb(15 23 42 / 12%)',
    });
  });

  it.each([
    ['MercadoZetta', defaultBrand.theme],
    ['CampusMarket', campusMarketBrand.theme],
  ])('keeps %s text and actions at WCAG AA contrast', (_, theme) => {
    expectReadableTheme(theme);
  });
});
