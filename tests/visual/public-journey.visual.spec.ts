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

test('home mantém hierarquia e CTAs na primeira dobra', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('pulso_privacy_notice_seen', 'true'));
  await page.goto('/');
  await stabilize(page);

  const register = page.getByRole('link', { name: /registrar ocorrência/i });
  const follow = page.getByRole('link', { name: /acompanhar protocolo/i });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(register).toBeVisible();
  await expect(follow).toBeVisible();

  const viewport = page.viewportSize();
  const registerBox = await register.boundingBox();
  const followBox = await follow.boundingBox();
  expect(viewport).not.toBeNull();
  expect(registerBox).not.toBeNull();
  expect(followBox).not.toBeNull();
  expect((registerBox?.y || 0) + (registerBox?.height || 0)).toBeLessThanOrEqual(viewport?.height || Number.MAX_SAFE_INTEGER);
  expect((followBox?.y || 0) + (followBox?.height || 0)).toBeLessThanOrEqual(viewport?.height || Number.MAX_SAFE_INTEGER);

  await capture(page, 'home-publica', testInfo.project.name);
});

test('aviso de privacidade respeita a navegação touch', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('pulso_privacy_notice_seen'));
  await page.goto('/');
  await stabilize(page);
  await page.waitForTimeout(1900);

  const notice = page.locator('[data-privacy-notice]');
  await expect(notice).toBeVisible();

  const viewport = page.viewportSize();
  const box = await notice.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if ((viewport?.width || 0) < 1024) {
    expect((box?.y || 0) + (box?.height || 0)).toBeLessThanOrEqual((viewport?.height || 0) - 70);
  }

  await capture(page, 'home-privacidade', testInfo.project.name);
});

test('registro mantém fluxo guiado, privacidade e revisão no mobile', async ({ page }, testInfo) => {
  await page.goto('/demandas/nova');
  await stabilize(page);

  const viewport = page.viewportSize();
  const isPhone = (viewport?.width || 0) < 640;

  if (isPhone) {
    await expect(page.getByRole('progressbar', { name: /etapa do registro/i })).toBeVisible();
    await expect(page.locator('[data-register-step="1"]')).toBeVisible();
    await page.getByLabel('Faixa etária').selectOption('AGE_25_34');
    await page.getByLabel('Logradouro ou via').fill('Av. Teste Visual');
    await page.getByLabel('Bairro ou localidade').fill('Centro');
    await capture(page, 'registro-etapa-1', testInfo.project.name);

    await page.getByRole('button', { name: /^continuar$/i }).click();
    await expect(page.locator('[data-register-step="2"]')).toBeVisible();
    await page.getByLabel('Seu nome').fill('Pessoa QA Visual');
    await page.getByLabel('O que aconteceu?').fill('Ocorrência de teste visual para validar o fluxo guiado no celular.');
    await expect(page.getByText(/adicionar evidências/i)).toBeVisible();
    await expect(page.getByText(/o protocolo é gerado mesmo sem contato/i)).toBeVisible();
    await capture(page, 'registro-etapa-2', testInfo.project.name);

    await page.getByRole('button', { name: /^revisar/i }).click();
    await expect(page.locator('[data-register-step="3"]')).toBeVisible();
    await expect(page.locator('[data-register-review]')).toBeVisible();
    await expect(page.getByText(/revise antes de enviar/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar e gerar protocolo/i })).toBeVisible();
    await expect(page.getByText(/não substitui canais oficiais/i)).toBeVisible();
    await capture(page, 'registro-etapa-3', testInfo.project.name);
  } else {
    await expect(page.getByRole('progressbar', { name: /progresso do registro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar e gerar protocolo/i })).toBeVisible();
    await expect(page.getByText(/não substitui canais oficiais/i)).toBeVisible();
    await capture(page, 'registro-publico', testInfo.project.name);
  }
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
