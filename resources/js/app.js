/**
 * app.js
 * Point d’entrée principal de votre bundle JS.
 */

// Charge bootstrap.js (jQuery, Bootstrap, Axios, Echo...)
import './bootstrap';

// Ici vous pouvez ajouter tout votre JS application‑wide.
// Par exemple : écouter l’événement broadcast 'DatabaseUpdated'.
window.Echo.channel('global')
    .listen('DatabaseUpdated', (payload) => {
        console.log('Base de données mise à jour à', payload.time);
        // Recharge la page pour synchroniser tous les onglets
        window.location.reload();
    });

// Exemple : code JS spécifique à votre application
// import './components/monComposant';
// import './vendor/autrePlugin';
