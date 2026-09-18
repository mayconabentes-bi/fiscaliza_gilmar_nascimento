import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const captureDir = path.resolve('test-results/visual');
fs.mkdirSync(captureDir, { recursive: true });

async function stabilize(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

async function capture(page: Page, name: string, projectName: string) {
  await page.screenshot({
    path: path.join(captureDir, `${projectName}-${name}.png`),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
}

async function mockCommonPublicApis(page: Page) {
  await page.route('**/api/mobile-events', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        publicDemandIntake: true,
        photoEvidence: true,
        privacyContact: '',
        privacyNoticeVersion: 'visual-qa-v1',
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockCommonPublicApis(page);
});

test('home mantém hierarquia e CTAs sem overflow', async ({ page }, testInfo) => {
  await page.goto('/');
  await stabilize(page);

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /registrar ocorrência/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /acompanhar protocolo/i })).toBeVisible();
  await capture(page, 'home-publica', testInfo.project.name);
});

test('registro mantém progresso, privacidade e toque confortável', async ({ page }, testInfo) => {
  await page.goto('/demandas/nova');
  await stabilize(page);

  await expect(page.getByRole('progressbar', { name: /progresso do registro/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /enviar e gerar protocolo/i })).toBeVisible();
  await expect(page.getByText(/não substitui canais oficiais/i)).toBeVisible();
  await capture(page, 'registro-publico', testInfo.project.name);
});

test('acompanhamento usa somente status público determinístico', async ({ page }, testInfo) => {
  await page.route('**/api/demandas/protocolo/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        demanda: {
          protocolo: 'AM-VISUAL-QA',
          municipio: 'Manaus',
          categoria: 'INFRAESTRUTURA_URBANA',
          tipo_problema: 'BURACO_PAVIMENTACAO',
          status: 'EM_ANALISE',
          created_at: '2026-09-17T12:00:00.000Z',
          updated_at: '2026-09-17T16:30:00.000Z',
        },
        historico: [
          { status_novo: 'RECEBIDA', created_at: '2026-09-17T12:00:00.000Z' },
          { status_novo: 'EM_TRIAGEM', created_at: '2026-09-17T14:00:00.000Z' },
          { status_novo: 'EM_ANALISE', created_at: '2026-09-17T16:30:00.000Z' },
        ],
      }),
    });
  });

  await page.goto('/protocolo?codigo=AM-VISUAL-QA');
  await stabilize(page);

  await expect(page.getByText('AM-VISUAL-QA')).toBeVisible();
  await expect(page.getByText(/em análise/i).first()).toBeVisible();
  await expect(page.getByText(/descrição, contato, foto/i)).toBeVisible();
  await capture(page, 'acompanhamento-publico', testInfo.project.name);
});
