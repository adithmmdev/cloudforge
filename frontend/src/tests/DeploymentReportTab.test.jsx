import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DeploymentReportTab from '../components/tabs/DeploymentReportTab';
import { vi, test, expect } from 'vitest';
import '@testing-library/jest-dom';

global.fetch = vi.fn();

test('DeploymentReportTab consumes markdown field', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ markdown: '# Test Report' })
  });

  render(
    <DeploymentReportTab deploymentId='123' />
  );

  await waitFor(() => {
    expect(screen.getByText(/Test Report/i)).toBeInTheDocument();
  });
});
