import '../app.css';
import { mount } from 'svelte';
import Broadcast from './Broadcast.svelte';

const app = mount(Broadcast, { target: document.getElementById('broadcast')! });
export default app;
