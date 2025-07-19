@extends('layouts.app')

@section('content')
<div class="container">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header">Tableau de bord</div>

        <div class="card-body">
          Bienvenue, {{ Auth::user()->name }} !
          {{-- … le reste de votre dashboard … --}}
        </div>
      </div>
    </div>
  </div>
</div>
@endsection