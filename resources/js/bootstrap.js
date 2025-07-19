// resources/js/bootstrap.js

// 1. Lodash
import _ from 'lodash';
window._ = _;

// 2. jQuery, Popper et Bootstrap
import * as Popper from '@popperjs/core';
window.Popper = Popper;
import $ from 'jquery';
window.$ = window.jQuery = $;
import 'bootstrap';

// 3. Axios
import axios from 'axios';
window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// 4. CSRF token
const tokenMeta = document.head.querySelector('meta[name="csrf-token"]');
if (tokenMeta) {
  window.axios.defaults.headers.common['X-CSRF-TOKEN'] = tokenMeta.content;
} else {
  console.error('CSRF token introuvable');
}

// 5. Laravel Echo + Pusher
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;
window.Pusher.logToConsole = true;

window.Echo = new Echo({
  broadcaster: 'pusher',
  key:    import.meta.env.VITE_PUSHER_APP_KEY,
  cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
  forceTLS: true,
});

// 6. Écoute de l’événement
window.Echo.channel('global')
  .listen('DatabaseUpdated', e => {
    console.log('Base mise à jour à', e.time);
    // → rafraîchir ici votre partie de page, par ex. :
    // window.location.reload();
  });
