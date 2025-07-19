<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <link rel="icon" href="{{ asset('favicon.ico') }}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name', 'Comptabilité famille Meilhac') }}</title>

    <!-- Fonts -->
    <link rel="dns-prefetch" href="//fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=Nunito" rel="stylesheet">

    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet">

    <!-- Vite -->
    @vite(['resources/sass/app.scss', 'resources/js/app.js'])

    <style>
      /* Dropdown on hover */
      .navbar-nav .dropdown:hover .dropdown-menu {
        display: block;
      }
      .navbar-nav .dropdown .dropdown-menu {
        margin-top: 0;
      }
      /* Quand body.loading : désactive et grise uniquement liens et boutons */
      body.loading a,
      body.loading button {
        pointer-events: none !important;
        opacity: 0.6;
      }
    </style>
</head>
<body>
    <div id="app">
        <nav class="navbar navbar-expand-md navbar-light bg-white shadow-sm">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="{{ url('/') }}">
                    <img src="{{ asset('images/logo-meilhac.png') }}"
                         alt="{{ config('app.name') }}"
                         height="60"
                         class="me-2">
                    {{ config('app.name', 'Comptabilité famille Meilhac') }}
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                        data-bs-target="#navbarSupportedContent"
                        aria-controls="navbarSupportedContent"
                        aria-expanded="false"
                        aria-label="{{ __('Toggle navigation') }}">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <!-- Left Side -->
                    <ul class="navbar-nav me-auto align-items-center">
                        {{-- Écritures --}}
                        <li class="nav-item dropdown">
                            <a id="navEcritures" class="nav-link dropdown-toggle"
                               href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                Écritures
                            </a>
                            <ul class="dropdown-menu" aria-labelledby="navEcritures">
                                <li><a class="dropdown-item" href="{{ route('ecritures.create') }}">Saisie</a></li>
                                <li><a class="dropdown-item" href="{{ route('ecritures.journal') }}">Journal</a></li>
                            </ul>
                        </li>
                        <li class="nav-item"><span class="nav-link">|</span></li>
                        {{-- Consultation --}}
                        <li class="nav-item dropdown">
                            <a id="navConsultation" class="nav-link dropdown-toggle"
                               href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                Consultation
                            </a>
                            <ul class="dropdown-menu" aria-labelledby="navConsultation">
                                <li><a class="dropdown-item" href="{{ route('consult.balance') }}">Balance</a></li>
                                <li><a class="dropdown-item" href="{{ route('consult.grand_livre') }}">Grand-livre</a></li>
								<li><a class="dropdown-item" href="{{ route('consult.search') }}">Rechercher</a></li>
                            </ul>
                        </li>
                        <li class="nav-item"><span class="nav-link">|</span></li>
                        {{-- Paramètres --}}
                        <li class="nav-item dropdown">
                            <a id="navParametres" class="nav-link dropdown-toggle"
                               href="#" role="button" data-bs-toggle="dropdown"
                               aria-expanded="false">
                                Paramètres
                            </a>
                            <ul class="dropdown-menu" aria-labelledby="navParametres">
                                <li><a class="dropdown-item" href="{{ url('/parametres/plan-comptable') }}">Plan comptable</a></li>
                                <li><a class="dropdown-item" href="{{ url('/parametres/export') }}">Export</a></li>
                            </ul>
                        </li>
                    </ul>
                    <!-- Right Side -->
                    <ul class="navbar-nav ms-auto align-items-center">
                        @guest
                            @if (Route::has('login'))
                                <li class="nav-item">
                                    <a class="nav-link" href="{{ route('login') }}">{{ __('Se connecter') }}</a>
                                </li>
                            @endif
							{{-- inscription désactivée --}}
                            {{--@if (Route::has('register'))--}}
                                {{--<li class="nav-item">--}}
                                    {{--<a class="nav-link" href="{{ route('register') }}">{{ __('Créer un compte') }}</a>--}}
                                {{--</li>--}}
                            {{--@endif--}}
                        @else
                            <li class="nav-item dropdown">
                                <a id="navbarDropdown" class="nav-link dropdown-toggle"
                                   href="#" role="button" data-bs-toggle="dropdown"
                                   aria-haspopup="true" aria-expanded="false" v-pre>
                                    {{ Auth::user()->name }}
                                </a>
                                <div class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                                    <a class="dropdown-item"
                                       href="{{ route('logout') }}"
                                       onclick="event.preventDefault();
                                                 document.getElementById('logout-form').submit();">
                                        {{ __('Logout') }}
                                    </a>
                                    <form id="logout-form"
                                          action="{{ route('logout') }}"
                                          method="POST"
                                          class="d-none">
                                        @csrf
                                    </form>
                                </div>
                            </li>
                        @endguest
                    </ul>
                </div>
            </div>
        </nav>
        <main class="py-4">
            @yield('content')
        </main>
    </div>

    <!-- Bootstrap Bundle JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.1/dist/js/bootstrap.bundle.min.js"></script>
    @stack('scripts')

    <script>
      // Dès qu’une vraie navigation démarre…
      window.addEventListener('beforeunload', function () {
        document.body.classList.add('loading');
      });
      // …et quand l’onglet retrouve le focus (ex. téléchargement sans reload)
      window.addEventListener('focus', function () {
        document.body.classList.remove('loading');
      });
      // Après soumission de n’importe quel formulaire, on retire loading
      document.querySelectorAll('form').forEach(function(form) {
        form.addEventListener('submit', function() {
          setTimeout(function() {
            document.body.classList.remove('loading');
          }, 800);
        });
      });
    </script>
</body>
</html>
