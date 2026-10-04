import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../App.tsx';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location" hidden>{location.pathname + location.search}</output>;
}

/** The whole app at a URL, with an in-memory router. */
export function renderApp(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App env="test" />
      <LocationProbe />
    </MemoryRouter>,
  );
}
