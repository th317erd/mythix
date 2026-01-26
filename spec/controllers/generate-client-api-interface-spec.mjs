import { generateClientAPIInterface } from '../../lib/controllers/generate-client-api-interface.mjs';
import { newTestApplication }         from '../support/application.mjs';
import { matchesSnapshot }            from '../support/snapshots.mjs';

function getRoutes() {
}

describe('generateClientAPIInterface', () => {
  let app;

  beforeAll(async () => {
    try {
      app = await newTestApplication();
      app.getRoutes = getRoutes.bind(app);
    } catch (error) {
      console.error('Error in beforeAll: ', error);
    }
  });

  it('should be able to generate an interface using route definitions', () => {
    let result = generateClientAPIInterface(app);
    expect(matchesSnapshot(result)).toBe(true);
  });

  it('should be able to generate an interface for node', () => {
    let result = generateClientAPIInterface(app, { environment: 'node' });
    expect(matchesSnapshot(result)).toBe(true);
  });

  it('should be able to generate an interface for the browser', () => {
    let result = generateClientAPIInterface(app, { environment: 'browser' });
    expect(matchesSnapshot(result)).toBe(true);
  });

  it('should be able to export a global', () => {
    let result = generateClientAPIInterface(app, { globalName: 'API' });
    expect(matchesSnapshot(result)).toBe(true);
  });

  it('should be able to specify a domain', () => {
    let result = generateClientAPIInterface(app, { domain: 'http://localhost:8080' });
    expect(matchesSnapshot(result)).toBe(true);
  });
});
