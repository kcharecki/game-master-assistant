// Dev-only component preview harness. Renders individual module components in
// isolation (no app shell, no broadcast iframe) so screenshots are fast and a
// single component can be compared against its Claude Design mock. Not shipped
// (preview.html is absent from vite build inputs). See CLAUDE.md → "Component
// preview harness".
import '../app.css';
import { mount } from 'svelte';
import Preview from './Preview.svelte';

const app = mount(Preview, { target: document.getElementById('preview')! });
export default app;
