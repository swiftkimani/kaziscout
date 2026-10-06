import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { JobDetailPage } from '../src/features/jobs/JobDetailPage';
import { BOARD, JOB, META, renderApp, stubApi } from './render';

const route = { at: '/jobs/job1', path: '/jobs/:id' };
const WITH_AI = { ...META, features: { ...META.features, aiModel: 'test-model' } };
const DOCUMENTS = {
  jobId: 'job1',
  coverLetterMd: 'Dear hiring team,',
  cvMd: '# CV',
  model: 'test-model',
  createdAt: '2026-10-06T10:00:00Z',
};

describe('JobDetailPage', () => {
  it('shows the posting, the fit and a link to the original', async () => {
    stubApi({
      'GET /v1/meta': META,
      'GET /v1/boards': { data: [BOARD] },
      'GET /v1/jobs/job1': { data: { ...JOB, application: null } },
      'GET /v1/jobs/job1/documents': { data: null },
    });

    renderApp(<JobDetailPage />, route);

    expect(await screen.findByRole('heading', { name: 'Frontend Developer' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeTruthy();
    expect(screen.getByText('Strong match. Worth applying.')).toBeTruthy();
    expect(screen.getByText('Keyword score')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open original posting/ }).getAttribute('href')).toBe(
      JOB.url,
    );
  });

  it('hides AI actions and explains how to get documents when no model is connected', async () => {
    stubApi({
      'GET /v1/meta': META,
      'GET /v1/boards': { data: [BOARD] },
      'GET /v1/jobs/job1': { data: { ...JOB, application: null } },
      'GET /v1/jobs/job1/documents': { data: null },
    });

    renderApp(<JobDetailPage />, route);

    expect(await screen.findByText(/Connect an AI model/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Assess with AI' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write cover letter and CV' })).toBeNull();
  });

  it('saves the job to the tracker', async () => {
    const requests = stubApi({
      'GET /v1/meta': META,
      'GET /v1/boards': { data: [BOARD] },
      'GET /v1/jobs/job1': { data: { ...JOB, application: null } },
      'GET /v1/jobs/job1/documents': { data: null },
      'POST /v1/applications': () => ({ status: 201, json: { data: { id: 1 } } }),
    });
    const user = userEvent.setup();
    renderApp(<JobDetailPage />, route);

    await user.click(await screen.findByRole('button', { name: 'Save to tracker' }));

    expect(await screen.findByText('Saved to your tracker.')).toBeTruthy();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({ jobId: 'job1' });
  });

  it('has the model write the documents, then offers each to copy or print', async () => {
    stubApi({
      'GET /v1/meta': WITH_AI,
      'GET /v1/boards': { data: [BOARD] },
      'GET /v1/jobs/job1': { data: { ...JOB, application: null } },
      'GET /v1/jobs/job1/documents': { data: null },
      'POST /v1/jobs/job1/documents': { data: DOCUMENTS },
    });
    const user = userEvent.setup();
    renderApp(<JobDetailPage />, route);

    await user.click(await screen.findByRole('button', { name: 'Write cover letter and CV' }));

    expect(await screen.findByRole('heading', { name: 'Cover letter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tailored CV' })).toBeTruthy();
    expect(screen.getByText(/Written by test-model/)).toBeTruthy();
    const printLinks = screen.getAllByRole('link', { name: 'Open to print' });
    expect(printLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/jobs/job1/print/cover-letter',
      '/jobs/job1/print/cv',
    ]);
  });

  it("shows the model's failure instead of pretending documents were written", async () => {
    stubApi({
      'GET /v1/meta': WITH_AI,
      'GET /v1/boards': { data: [BOARD] },
      'GET /v1/jobs/job1': { data: { ...JOB, application: null } },
      'GET /v1/jobs/job1/documents': { data: null },
      'POST /v1/jobs/job1/documents': () => ({
        status: 400,
        json: {
          error: { code: 'VALIDATION_FAILED', message: 'Paste your CV into your profile first.' },
        },
      }),
    });
    const user = userEvent.setup();
    renderApp(<JobDetailPage />, route);

    await user.click(await screen.findByRole('button', { name: 'Write cover letter and CV' }));

    expect(await screen.findByText('Paste your CV into your profile first.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Cover letter' })).toBeNull();
  });
});
