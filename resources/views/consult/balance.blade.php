@extends('layouts.app')

@section('content')
<div class="container">
  <div class="mx-auto" style="width:70%;">
    <h1 class="mb-4">Balance</h1>

    {{-- Formulaire de filtres --}}
    <form id="filter-form" method="GET" action="{{ route('consult.balance') }}" class="mb-3">
      <div class="row align-items-center g-3">
        {{-- Période principale --}}
        <div class="col-auto d-flex align-items-center">
          <label class="fw-bold mb-0 me-2">Période :</label>
          <input type="date"
                 name="period1_start"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 value="{{ request('period1_start', $period1Start) }}">
          <span class="me-2">au</span>
          <input type="date"
                 name="period1_end"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 value="{{ request('period1_end', $period1End) }}">
        </div>

        {{-- Comparaison --}}
        <div class="col-auto d-flex align-items-center">
          <div class="form-check form-check-inline me-2 d-flex align-items-center">
            <input class="form-check-input"
                   type="checkbox"
                   id="enable_compare"
                   name="enable_compare"
                   value="1"
                   {{ request('enable_compare') ? 'checked' : '' }}>
            <label class="form-check-label fw-bold mb-0 ms-1" for="enable_compare">
              Comparaison :
            </label>
          </div>
          <input type="date"
                 name="period2_start"
                 id="period2_start"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 {{ request('enable_compare') ? '' : 'disabled' }}
                 value="{{ request('period2_start', $period2Start) }}">
          <span class="me-2">au</span>
          <input type="date"
                 name="period2_end"
                 id="period2_end"
                 class="form-control form-control-sm"
                 style="width:120px"
                 {{ request('enable_compare') ? '' : 'disabled' }}
                 value="{{ request('period2_end', $period2End) }}">
        </div>

        {{-- Bouton Filtrer --}}
        <div class="col-auto">
          <button type="submit" class="btn btn-primary btn-sm">Filtrer</button>
        </div>
      </div>

      {{-- Masquer soldes nuls --}}
      <div class="mt-2">
        <div class="form-check d-inline-flex align-items-center">
          <input class="form-check-input me-1"
                 type="checkbox"
                 id="hide_zero"
                 name="hide_zero"
                 value="1"
                 {{ request('hide_zero') ? 'checked' : '' }}
                 onchange="document.getElementById('filter-form').submit()">
          <label class="form-check-label small mb-0" for="hide_zero">
            Masquer soldes nuls
          </label>
        </div>
      </div>
    </form>

    {{-- Boutons d’action --}}
    <div class="mb-2">
      <button id="btn-transfer"
              class="btn btn-warning btn-sm me-2"
              data-bs-toggle="modal"
              data-bs-target="#transferModal"
              disabled>
        Transfert
      </button>
      <button id="btn-export"
              class="btn btn-success btn-sm"
              data-bs-toggle="modal"
              data-bs-target="#exportModal"
              disabled>
        Export
      </button>
    </div>

    {{-- Tableau Balance --}}
    <table id="balance-table" class="table table-sm table-striped table-hover">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th class="px-1">Compte <span class="sort-arrow"></span></th>
          <th class="px-1">Nom compte <span class="sort-arrow"></span></th>
          <th class="text-end px-1">Solde <span class="sort-arrow"></span></th>
          @if(request('enable_compare'))
            <th class="text-end px-1">Solde comparé <span class="sort-arrow"></span></th>
            <th class="text-end px-1">Variation <span class="sort-arrow"></span></th>
          @endif
        </tr>
      </thead>
      <tbody>
        @foreach($data as $row)
          @php
            $zero1 = abs($row['solde1']) < 0.001;
            $zero2 = (!isset($row['solde2']) || abs($row['solde2']) < 0.001);
            $hide  = request('hide_zero') && $zero1 && $zero2;
          @endphp
          @unless($hide)
            <tr class="clickable-row"
                data-href="{{ route('consult.grand_livre', [
                    'account'      => $row['compte'],
                    'period_start' => request('period1_start'),
                    'period_end'   => request('period1_end'),
                ]) }}">
              <td class="px-1">
                <input type="checkbox" class="select-row" value="{{ $row['compte'] }}">
              </td>
              <td class="px-1">{{ $row['compte'] }}</td>
              <td class="px-1">{{ $row['libelle'] }}</td>
              <td class="text-end px-1">{{ number_format($row['solde1'],2,',',' ') }} €</td>
              @if(request('enable_compare'))
                <td class="text-end px-1">{{ number_format($row['solde2'] ?? 0,2,',',' ') }} €</td>
                <td class="text-end px-1">{{ number_format($row['variation'] ?? 0,2,',',' ') }} €</td>
              @endif
            </tr>
          @endunless
        @endforeach
      </tbody>
    </table>
  </div>
</div>

{{-- Modal Transfert --}}
<div class="modal fade" id="transferModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('consult.balance.transfer') }}">
      @csrf
      <input type="hidden" name="account_ids"    id="transfer-ids">
      <input type="hidden" name="period1_start"  value="{{ request('period1_start') }}">
      <input type="hidden" name="period1_end"    value="{{ request('period1_end') }}">
      <input type="hidden" name="enable_compare" value="{{ request('enable_compare') }}">
      <input type="hidden" name="period2_start"  value="{{ request('period2_start') }}">
      <input type="hidden" name="period2_end"    value="{{ request('period2_end') }}">
      <input type="hidden" name="hide_zero"      value="{{ request('hide_zero') }}">

      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Transférer les lignes</h5>
        </div>
        <div class="modal-body">
          <label for="transfer-select">Vers le compte :</label>
          <select name="transfer_account"
                  id="transfer-select"
                  class="form-select mb-2 @error('transfer_account') is-invalid @enderror"
                  required
                  pattern="\d{6}"
                  title="Entrez exactement 6 chiffres">
            <option value="">-- Sélectionnez un compte --</option>
            @foreach(\App\Models\Compte::orderBy('numero')->get() as $c)
              <option value="{{ $c->numero }}">{{ $c->numero }} – {{ $c->libelle }}</option>
            @endforeach
          </select>
          @error('transfer_account')
            <div class="invalid-feedback">{{ $message }}</div>
          @enderror
          <div class="text-end">
            <button type="button"
                    class="btn btn-outline-primary btn-sm"
                    data-bs-toggle="modal"
                    data-bs-target="#createCompteModal">
              + Créer un compte
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button type="submit" class="btn btn-warning">Transférer</button>
        </div>
      </div>
    </form>
  </div>
</div>

{{-- Modal création de compte --}}
<div class="modal fade" id="createCompteModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <form action="{{ route('comptes.store') }}" method="POST" novalidate>
        @csrf
        <div class="modal-header">
          <h5 class="modal-title">Créer un compte</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" name="preserve_period1_start"  value="{{ request('period1_start') }}">
          <input type="hidden" name="preserve_period1_end"    value="{{ request('period1_end') }}">
          <input type="hidden" name="preserve_enable_compare" value="{{ request('enable_compare') }}">
          <input type="hidden" name="preserve_period2_start"  value="{{ request('period2_start') }}">
          <input type="hidden" name="preserve_period2_end"    value="{{ request('period2_end') }}">
          <input type="hidden" name="preserve_hide_zero"      value="{{ request('hide_zero') }}">
          <input type="hidden" name="preserve_account_ids"    value="{{ session('preserve_account_ids', '') }}">

          <div class="mb-3">
            <label class="form-label" for="numero">Numéro</label>
            <input type="text"
                   id="numero"
                   name="numero"
                   class="form-control @error('numero') is-invalid @enderror"
                   required
                   pattern="\d{6}"
                   title="Entrez exactement 6 chiffres">
            @error('numero')<div class="invalid-feedback">{{ $message }}</div>@enderror
          </div>
          <div class="mb-3">
            <label class="form-label" for="libelle">Libellé</label>
            <input type="text"
                   id="libelle"
                   name="libelle"
                   class="form-control @error('libelle') is-invalid @enderror"
                   required>
            @error('libelle')<div class="invalid-feedback">{{ $message }}</div>@enderror
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  </div>
</div>

{{-- Modal Export --}}
<div class="modal fade" id="exportModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form id="export-form" method="POST" action="{{ route('consult.balance.export') }}">
      @csrf
      <input type="hidden" name="account_ids" id="export-ids">
      {{-- On utilise maintenant le fallback vers les variables PHP --}}
      <input type="hidden" name="period1_start"  value="{{ request('period1_start',  $period1Start) }}">
      <input type="hidden" name="period1_end"    value="{{ request('period1_end',    $period1End) }}">
      <input type="hidden" name="enable_compare" value="{{ request('enable_compare') }}">
      <input type="hidden" name="period2_start"  value="{{ request('period2_start',  $period2Start) }}">
      <input type="hidden" name="period2_end"    value="{{ request('period2_end',    $period2End) }}">

      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Export de la balance</h5>
        </div>
        <div class="modal-body">
          <div class="form-check">
            <input class="form-check-input" type="radio" name="export_format" id="fmtExcel" value="excel" checked>
            <label class="form-check-label" for="fmtExcel">Excel</label>
          </div>
          <div class="form-check">
            <input class="form-check-input" type="radio" name="export_format" id="fmtPdf" value="pdf">
            <label class="form-check-label" for="fmtPdf">PDF</label>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button type="submit" class="btn btn-success">Exporter</button>
        </div>
      </div>
    </form>
  </div>
</div>


@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  // Fermer l'alerte succès après 2s
  const alert = document.getElementById('success-alert');
  if (alert) {
    setTimeout(() => alert.remove(), 2000);
  }

  // Activation dynamique des dates de comparaison
  const chk    = document.getElementById('enable_compare');
  const start2 = document.getElementById('period2_start');
  const end2   = document.getElementById('period2_end');
  chk.addEventListener('change', () => {
    if (chk.checked) {
      start2.removeAttribute('disabled');
      end2.removeAttribute('disabled');
    } else {
      start2.setAttribute('disabled','disabled');
      end2.setAttribute('disabled','disabled');
    }
  });

  // Gestion sélection / activation boutons
  const tbody     = document.querySelector('#balance-table tbody');
  const selectAll = document.getElementById('select-all');
  const btnTrans  = document.getElementById('btn-transfer');
  const btnExp    = document.getElementById('btn-export');
  const transIds  = document.getElementById('transfer-ids');
  const exportIds = document.getElementById('export-ids');

  function updateButtons() {
    const any = Array.from(tbody.querySelectorAll('.select-row')).some(cb => cb.checked);
    btnTrans.disabled = !any;
    btnExp.disabled   = !any;
  }
  selectAll.addEventListener('change', () => {
    tbody.querySelectorAll('.select-row').forEach(cb => cb.checked = selectAll.checked);
    updateButtons();
  });
  tbody.addEventListener('change', e => {
    if (e.target.matches('.select-row')) updateButtons();
  });

  function collect() {
    return Array.from(tbody.querySelectorAll('.select-row'))
                .filter(cb => cb.checked)
                .map(cb => cb.value)
                .join(',');
  }

  document.getElementById('transferModal').addEventListener('show.bs.modal', () => {
    transIds.value = collect();
  });
  document.getElementById('exportModal').addEventListener('show.bs.modal', () => {
    exportIds.value = collect();
  });

  // Fermer le modal avant lancement de l’export
  document.getElementById('export-form').addEventListener('submit', () => {
    const modalEl = document.getElementById('exportModal');
    bootstrap.Modal.getInstance(modalEl).hide();
  });

  // Rouvrir le modal de transfert si nouveau compte créé
  @if(session('new_compte'))
    const transferModal = new bootstrap.Modal(document.getElementById('transferModal'));
    transferModal.show();
    document.getElementById('transfer-select').value = "{{ session('new_compte') }}";
  @endif

  // Rouvrir le modal de création de compte en cas d'erreurs de validation
  @if($errors->has('numero') || $errors->has('libelle'))
    const createModal = new bootstrap.Modal(document.getElementById('createCompteModal'));
    createModal.show();
  @endif

  // Tri simple
  const headers = document.querySelectorAll('#balance-table th');
  const getVal  = (row, idx) => row.children[idx].innerText.replace(/\s|€|,/g,'');
  const comparer = (idx, asc) => (a,b) => {
    const vA = parseFloat(getVal(a, idx)), vB = parseFloat(getVal(b, idx));
    return (!isNaN(vA) && !isNaN(vB))
      ? (asc ? vA-vB : vB-vA)
      : (asc ? getVal(a, idx).localeCompare(getVal(b, idx))
             : getVal(b, idx).localeCompare(getVal(a, idx)));
  };
  headers.forEach((th, i) => {
    if (i === 0) return;
    let asc = i===1;
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      Array.from(tbody.querySelectorAll('tr'))
           .sort(comparer(i, asc))
           .forEach(r => tbody.appendChild(r));
      asc = !asc;
    });
  });

  // Rendre les lignes cliquables
  document.querySelectorAll('.clickable-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', e => {
      if (e.target.closest('input[type=checkbox]')) return;
      window.location.href = row.dataset.href;
    });
  });
});
</script>
@endpush

@endsection
