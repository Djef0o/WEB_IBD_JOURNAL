// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Component, h, render, type ComponentChildren } from 'preact';
import { act } from 'preact/test-utils';
import { useLiveQuery } from '../src/db/live';
import { getStoolsInMonth, saveStool } from '../src/db/stools';
import { stool } from '../src/domain/models';
import { freshDb } from './helpers/freshDb';

let root: HTMLElement;

beforeEach(async () => {
  await freshDb();
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  render(null, root);
  root.remove();
});

function Month(props: { year: number; month: number }) {
  const list = useLiveQuery(['stools'], () => getStoolsInMonth(props.year, props.month), [props.year, props.month]);
  return h('p', null, list === undefined ? 'loading' : `${props.month}:${list.length}`);
}

class Boundary extends Component<{ children?: ComponentChildren }, { failed: boolean }> {
  override state = { failed: false };
  override componentDidCatch() {
    this.setState({ failed: true });
  }
  override render() {
    return this.state.failed ? h('p', null, 'failed') : this.props.children;
  }
}

describe('useLiveQuery', () => {
  it('shows undefined while loading, then the result, then follows writes', async () => {
    await act(() => render(h(Month, { year: 2026, month: 11 }), root));
    expect(root.textContent).toBe('loading');
    await vi.waitFor(() => expect(root.textContent).toBe('11:0'));

    await act(async () => {
      await saveStool(stool({ date: '2026-11-10' }));
    });
    await vi.waitFor(() => expect(root.textContent).toBe('11:1'));
  });

  it('re-runs when the dependencies change, never showing the old month', async () => {
    await saveStool(stool({ date: '2026-11-10' }));
    await saveStool(stool({ date: '2026-12-01' }));
    await saveStool(stool({ date: '2026-12-02' }));
    await act(() => render(h(Month, { year: 2026, month: 11 }), root));
    await vi.waitFor(() => expect(root.textContent).toBe('11:1'));

    await act(() => render(h(Month, { year: 2026, month: 12 }), root));
    expect(root.textContent).toBe('loading'); // neither '11:1' nor '12:1'
    await vi.waitFor(() => expect(root.textContent).toBe('12:2'));
  });

  it('stops watching when the component unmounts', async () => {
    const query = vi.fn(async () => 1);
    function Probe() {
      useLiveQuery(['stools'], query);
      return null;
    }
    await act(() => render(h(Probe, null), root));
    await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    await act(() => render(null, root));
    await saveStool(stool({ date: '2026-11-10' }));
    expect(query).toHaveBeenCalledTimes(1); // a live watch would have re-run it synchronously
  });

  it('throws a failing query during rendering, for an error boundary', async () => {
    function Failing() {
      useLiveQuery(['stools'], () => Promise.reject(new Error('read failed')));
      return null;
    }
    await act(() => render(h(Boundary, null, h(Failing, null)), root));
    await vi.waitFor(() => expect(root.textContent).toBe('failed'));
  });
});
