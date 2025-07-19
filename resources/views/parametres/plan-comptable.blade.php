@extends('layouts.app')

@section('content')
<div class="container">
  <h1 class="mb-4">Plan comptable</h1>

  {{-- Bouton Créer + message de succès alignés --}}
  <div class="d-flex align-items-center mb-3">
    <button class="btn btn-primary"
            data-bs-toggle="modal"
            data-bs-target="#createCompteModal">
      + Créer un compte
    </button>

    @if(session('success'))
      <div id="alert-success"
           class="alert alert-success mb-0 ms-3 d-flex align-items-center"
           style="height: calc(2.25rem + 2px);">
        {{ session('success') }}
      </div>
    @endif
  </div>

  @php
    $charges  = $comptes->filter(fn($c) => str_starts_with($c->numero, '6'));
    $produits = $comptes->filter(fn($c) => str_starts_with($c->numero, '7'));
    $bilan    = $comptes->reject(fn($c) => str_starts_with($c->numero, '6') || str_starts_with($c->numero, '7'));
  @endphp

  <div class="row">
    <div class="col-md-4 col-12 mb-4">
      <h5>Comptes de bilan</h5>
      <table class="table table-sm table-striped">
        <thead><tr><th>Compte</th><th>Libellé</th></tr></thead>
        <tbody>
          @foreach($bilan as $c)
            <tr 
              data-id="{{ $c->id }}"
              data-numero="{{ $c->numero }}"
              data-libelle="{{ $c->libelle }}"
              data-route-update="{{ route('parametres.plan_comptable.update', $c) }}"
              data-route-delete="{{ route('parametres.plan_comptable.destroy', $c) }}"
            >
              <td>{{ $c->numero }}</td>
              <td>{{ $c->libelle }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>

    <div class="col-md-4 col-12 mb-4">
      <h5>Comptes de charges</h5>
      <table class="table table-sm table-striped">
        <thead><tr><th>Compte</th><th>Libellé</th></tr></thead>
        <tbody>
          @foreach($charges as $c)
            <tr 
              data-id="{{ $c->id }}"
              data-numero="{{ $c->numero }}"
              data-libelle="{{ $c->libelle }}"
              data-route-update="{{ route('parametres.plan_comptable.update', $c) }}"
              data-route-delete="{{ route('parametres.plan_comptable.destroy', $c) }}"
            >
              <td>{{ $c->numero }}</td>
              <td>{{ $c->libelle }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>

    <div class="col-md-4 col-12 mb-4">
      <h5>Comptes de produits</h5>
      <table class="table table-sm table-striped">
        <thead><tr><th>Compte</th><th>Libellé</th></tr></thead>
        <tbody>
          @foreach($produits as $c)
            <tr 
              data-id="{{ $c->id }}"
              data-numero="{{ $c->numero }}"
              data-libelle="{{ $c->libelle }}"
              data-route-update="{{ route('parametres.plan_comptable.update', $c) }}"
              data-route-delete="{{ route('parametres.plan_comptable.destroy', $c) }}"
            >
              <td>{{ $c->numero }}</td>
              <td>{{ $c->libelle }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  </div>
</div>

{{-- Modal Création --}}
<div class="modal fade" id="createCompteModal" tabindex="-1">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('comptes.store') }}" class="modal-content">
      @csrf
      <div class="modal-header">
        <h5 class="modal-title">Créer un compte</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
          <label for="create-numero" class="form-label">Numéro</label>
          <input type="text" name="numero" id="create-numero"
                 class="form-control @error('numero') is-invalid @enderror"
                 required pattern="\d{6}"
                 value="{{ old('numero') }}">
          @error('numero')
            <div class="invalid-feedback">{{ $message }}</div>
          @enderror
        </div>
        <div class="mb-3">
          <label for="create-libelle" class="form-label">Libellé</label>
          <input type="text" name="libelle" id="create-libelle"
                 class="form-control @error('libelle') is-invalid @enderror"
                 required
                 value="{{ old('libelle') }}">
          @error('libelle')
            <div class="invalid-feedback">{{ $message }}</div>
          @enderror
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary">Créer le compte</button>
      </div>
    </form>
  </div>
</div>

{{-- Modal Édition / Suppression --}}
<div class="modal fade" id="editCompteModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form id="editForm" method="POST">
        @csrf
        @method('PUT')
        <div class="modal-header">
          <h5 class="modal-title">Modifier le compte</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          {{-- Zone d’erreur suppression --}}
          <div id="edit-error" class="alert alert-danger mb-2 d-none"></div>

          <div class="mb-3">
            <label for="edit-numero" class="form-label">Numéro</label>
            <input type="text" name="numero" id="edit-numero"
                   class="form-control"
                   style="background-color: #e0e0e0;"
                   readonly>
          </div>

          <div class="mb-3">
            <label for="edit-libelle" class="form-label">Libellé</label>
            <input type="text" name="libelle" id="edit-libelle"
                   class="form-control @error('libelle') is-invalid @enderror"
                   required>
            @error('libelle')
              <div class="invalid-feedback">{{ $message }}</div>
            @enderror
          </div>
        </div>
        <div class="modal-footer">
          <button type="submit" class="btn btn-success">Modifier</button>
          <button type="button" id="btn-delete" class="btn btn-danger">Supprimer</button>
        </div>
      </form>
      <form id="deleteForm" method="POST" style="display:none">
        @csrf
        @method('DELETE')
      </form>
    </div>
  </div>
</div>

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  // Masquage auto du message de succès
  const successAlert = document.getElementById('alert-success');
  if (successAlert) setTimeout(() => successAlert.remove(), 2000);

  // Rouvrir le modal de création si validation KO
  @if(session('showCreateModal'))
    new bootstrap.Modal(document.getElementById('createCompteModal')).show();
  @endif

  // Préparation du modal d’édition
  const rows       = document.querySelectorAll('tbody tr[data-id]');
  const editModal  = new bootstrap.Modal(document.getElementById('editCompteModal'));
  const editForm   = document.getElementById('editForm');
  const deleteForm = document.getElementById('deleteForm');
  const btnDelete  = document.getElementById('btn-delete');
  const editError  = document.getElementById('edit-error');

  // Si suppression interdite : on récupère les données de session
  @if(session('showEditModal'))
    @php $d = session('editModalData'); @endphp
    editForm.action   = "{{ $d['routeUpdate'] }}";
    deleteForm.action = "{{ $d['routeDelete'] }}";
    document.getElementById('edit-numero').value  = "{{ $d['numero'] }}";
    document.getElementById('edit-libelle').value = "{{ $d['libelle'] }}";
    editError.textContent = "{{ session('deleteError') }}";
    editError.classList.remove('d-none');
    editModal.show();
  @endif

  // Clic sur une ligne : on remplit et affiche le modal
  rows.forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      editError.classList.add('d-none');
      editForm.action   = row.dataset.routeUpdate;
      deleteForm.action = row.dataset.routeDelete;
      document.getElementById('edit-numero').value  = row.dataset.numero;
      document.getElementById('edit-libelle').value = row.dataset.libelle;
      editModal.show();
    });
  });

  // Suppression
  btnDelete.addEventListener('click', () => {
    deleteForm.submit();
  });
});
</script>
@endpush
@endsection
