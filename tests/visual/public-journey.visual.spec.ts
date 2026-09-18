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
    await expect(page.getByRole('button', { name: /adicionar contato para retorno/i })).toBeVisible();
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

test('acompanhamento coloca busca na primeira dobra', async ({ page }, testInfo) => {
  await page.goto('/protocolo');
  await stabilize(page);

  const input = page.getByLabel('Número do protocolo');
  const submit = page.getByRole('button', { name: /ver andamento/i });
  await expect(input).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(page.getByText(/consulta pública protegida/i)).toBeVisible();

  const viewport = page.viewportSize();
  const inputBox = await input.boundingBox();
  const submitBox = await submit.boundingBox();
  expect(viewport).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  if ((viewport?.width || 0) < 640) {
    expect((inputBox?.y || 0) + (inputBox?.height || 0)).toBeLessThanOrEqual(viewport?.height || Number.MAX_SAFE_INTEGER);
    expect((submitBox?.y || 0) + (submitBox?.height || 0)).toBeLessThanOrEqual(viewport?.height || Number.MAX_SAFE_INTEGER);
  }

  await capture(page, 'acompanhamento-busca', testInfo.project.name);
});

test('acompanhamento usa somente status público determinístico', async ({ page }, testInfo) => {
  await page.route('**/api/demandas/protocolo/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        demanda: {
          protocolo: 'AM-20260917-A1B2C3',
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

  await page.goto('/protocolo?codigo=AM-20260917-A1B2C3');
  await stabilize(page);

  await expect(page.getByText('AM-20260917-A1B2C3')).toBeVisible();
  await expect(page.locator('[data-followup-status]')).toBeVisible();
  await expect(page.getByText(/em análise/i).first()).toBeVisible();
  await expect(page.getByText(/descrição, contato, fotos, endereço detalhado/i)).toBeVisible();
  await expect(page.locator('[data-followup-history]')).toBeVisible();
  await capture(page, 'acompanhamento-publico', testInfo.project.name);
});

test('acompanhamento orienta protocolo não encontrado sem expor dados', async ({ page }, testInfo) => {
  await page.route('**/api/demandas/protocolo/**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Protocolo não encontrado.' }),
    });
  });

  await page.goto('/protocolo');
  await stabilize(page);
  await page.getByLabel('Número do protocolo').fill('AM-20260917-FFFFFF');
  await page.getByRole('button', { name: /ver andamento/i }).click();

  await expect(page.locator('[data-followup-error]')).toBeVisible();
  await expect(page.getByText('Protocolo não encontrado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /tentar novamente/i })).toBeVisible();
  await capture(page, 'acompanhamento-nao-encontrado', testInfo.project.name);
});

test('login cidadão prioriza autenticação comum na primeira dobra', async ({ page }, testInfo) => {
  await page.goto('/login');
  await stabilize(page);

  const email = page.getByLabel('E-mail');
  const password = page.locator('input[name="password"]');
  const submit = page.getByRole('button', { name: /^entrar$/i });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(page.getByRole('link', { name: /esqueci minha senha/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /não lembro meu e-mail/i })).toBeVisible();

  const viewport = page.viewportSize();
  if ((viewport?.width || 0) < 640) {
    await expect(page.getByRole('button', { name: /acesso administrativo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Administrador' })).toBeHidden();
    const submitBox = await submit.boundingBox();
    expect(submitBox).not.toBeNull();
    expect((submitBox?.y || 0) + (submitBox?.height || 0)).toBeLessThanOrEqual(viewport?.height || Number.MAX_SAFE_INTEGER);
  }

  await password.fill('senha-visual');
  await page.getByRole('button', { name: /mostrar senha/i }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: /ocultar senha/i }).click();
  await expect(password).toHaveAttribute('type', 'password');

  await capture(page, 'login-cidadao', testInfo.project.name);
});

test('login administrativo permanece claramente restrito', async ({ page }, testInfo) => {
  await page.goto('/login?admin=1');
  await stabilize(page);

  await expect(page.locator('[data-login-mode="admin"]')).toBeVisible();
  await expect(page.getByText(/não existe cadastro de administrador/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /entrar na área privada/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /criar conta/i })).toHaveCount(0);
  await capture(page, 'login-admin', testInfo.project.name);
});

test('login mantém erro de credenciais genérico', async ({ page }, testInfo) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Credenciais inválidas.' }),
    });
  });

  await page.goto('/login');
  await stabilize(page);
  await page.getByLabel('E-mail').fill('qa@example.com');
  await page.locator('input[name="password"]').fill('senha-invalida');
  await page.getByRole('button', { name: /^entrar$/i }).click();

  await expect(page.locator('[data-login-error]')).toBeVisible();
  await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible();
  await capture(page, 'login-erro', testInfo.project.name);
});

