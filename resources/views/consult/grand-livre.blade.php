{{-- resources/views/consult/grand-livre.blade.php --}}
@extends('layouts.app')

@section('content')
<style>
  /* Contrainte sur la hauteur de ligne + ellipsis */
  #gl-table td.truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

<div class="container">
  {{-- Wrapper centré à 75% --}}
  <div class="mx-auto" style="width:75%;">

    {{-- Titre --}}
    <h1 class="mb-4">Grand-Livre</h1>

    {{-- Formulaire de filtrage + actions --}}
    <form id="gl-form" method="GET" action="{{ route('consult.grand_livre') }}" class="mb-3">
      <div class="row align-items-center g-3">
        <div class="col-auto d-flex align-items-center">
          {{-- Précédent --}}
          <a href="{{ $prev
                ? route('consult.grand_livre', ['account'=>$prev->numero,'period_start'=>$start,'period_end'=>$end])
                : '#' }}"
             class="btn btn-outline-secondary btn-sm me-2"
             {{ $prev ? '' : 'disabled' }}>‹</a>

          {{-- Sélecteur de compte --}}
          <select name="account"
                  class="form-select form-select-sm me-2"
                  style="width:auto; height:2.25rem;"
                  onchange="this.form.submit()">
            @foreach($comptes as $c)
              <option value="{{ $c->numero }}"
                      {{ $c->numero == $account ? 'selected' : '' }}>
                {{ $c->numero }} – {{ $c->libelle }}
              </option>
            @endforeach
          </select>

          {{-- Suivant --}}
          <a href="{{ $next
                ? route('consult.grand_livre', ['account'=>$next->numero,'period_start'=>$start,'period_end'=>$end])
                : '#' }}"
             class="btn btn-outline-secondary btn-sm me-4"
             {{ $next ? '' : 'disabled' }}>›</a>

          {{-- Période --}}
          <label class="fw-bold mb-0 me-2">Période :</label>
          <input type="date"
                 name="period_start"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 value="{{ $start }}">
          <span class="me-2">au</span>
          <input type="date"
                 name="period_end"
                 class="form-control form-control-sm me-4"
                 style="width:120px"
                 value="{{ $end }}">
          <button type="submit" class="btn btn-primary btn-sm">Filtrer</button>
        </div>

        {{-- Boutons d’action --}}
        <div class="col-auto">
          <button id="btn-delete"
                  type="button"
                  class="btn btn-danger btn-sm me-2"
                  data-bs-toggle="modal"
                  data-bs-target="#deleteModal"
                  disabled>
            Suppression
          </button>
          <button id="btn-duplicate"
                  type="button"
                  class="btn btn-secondary btn-sm me-2"
                  data-bs-toggle="modal"
                  data-bs-target="#duplicateModal"
                  disabled>
            Duplication
          </button>
          <button id="btn-transfer"
                  type="button"
                  class="btn btn-warning btn-sm me-2"
                  data-bs-toggle="modal"
                  data-bs-target="#transferModal"
                  disabled>
            Transfert
          </button>
          <button id="btn-export"
                  type="button"
                  class="btn btn-success btn-sm"
                  data-bs-toggle="modal"
                  data-bs-target="#exportModal"
                  disabled>
            Export
          </button>
        </div>
      </div>
    </form>

    {{-- Tableau Grand-Livre --}}
    <table id="gl-table" class="table table-sm table-striped table-hover w-100">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>Date <span class="sort-arrow"></span></th>
          <th>Journal <span class="sort-arrow"></span></th>
          <th>N° Ecr. <span class="sort-arrow"></span></th>
          <th>Libellé écriture <span class="sort-arrow"></span></th>
          <th>Commentaire <span class="sort-arrow"></span></th>
          <th class="text-end">Montant <span class="sort-arrow"></span></th>
          <th class="text-end">Cumul <span class="sort-arrow"></span></th>
        </tr>
      </thead>
      <tbody>
        @foreach($lignes as $ln)
          <tr data-edit-url="{{ route('ecritures.edit', $ln->ecriture_id) }}">
            <td>
              <input type="checkbox" class="select-row" value="{{ $ln->line_id }}">
            </td>
            <td>{{ \Carbon\Carbon::createFromFormat('Y-m-d',$ln->date_iso)->format('d/m/Y') }}</td>
            <td>{{ $ln->journal_code }}</td>
            <td>{{ $ln->ecriture_id }}</td>
            <td class="truncate">{{ $ln->label_ecriture }}</td>
            <td class="truncate">{{ $ln->commentaire }}</td>
            <td class="truncate text-end montant-cell">
              {{ number_format($ln->montant,2,',',' ') }} €
            </td>
            <td class="truncate text-end cumul-cell"></td>
          </tr>
        @endforeach
      </tbody>
    </table>

    {{-- Modal édition in-page --}}
    <div class="modal fade" id="actionModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content" style="height:calc(100vh - 3rem);">
          <div class="modal-header">
            <h5 class="modal-title">Modifier l’écriture</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-0" style="flex:1 1 auto; overflow:hidden;">
            <iframe id="modal-iframe" style="width:100%;height:100%;border:none;"></iframe>
          </div>
        </div>
      </div>
    </div>

    {{-- Modal suppression --}}
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form method="POST" action="{{ route('consult.grand_livre.delete') }}">
          @csrf
          <input type="hidden" name="account"      value="{{ request('account') }}">
          <input type="hidden" name="period_start" value="{{ request('period_start') }}">
          <input type="hidden" name="period_end"   value="{{ request('period_end') }}">
          <input type="hidden" name="line_ids"     id="delete-ids">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirmer la suppression</h5>
            </div>
            <div class="modal-body">
              Supprimer les écritures et toutes leurs lignes pour les lignes sélectionnées ?
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="submit" class="btn btn-danger">Supprimer</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {{-- Modal duplication --}}
    <div class="modal fade" id="duplicateModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form method="POST" action="{{ route('consult.grand_livre.duplicate') }}">
          @csrf
          <input type="hidden" name="account"      value="{{ request('account') }}">
          <input type="hidden" name="period_start" value="{{ request('period_start') }}">
          <input type="hidden" name="period_end"   value="{{ request('period_end') }}">
          <input type="hidden" name="line_ids"     id="duplicate-ids">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Duplication</h5>
            </div>
            <div class="modal-body">
              <label>Date cible :</label>
              <input type="date" name="duplicate_date"
                     class="form-control"
                     value="{{ now()->format('Y-m-d') }}"
                     required>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
              <button type="submit" class="btn btn-secondary">Dupliquer</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {{-- Modal transfert --}}
    <div class="modal fade" id="transferModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form method="POST" action="{{ route('consult.grand_livre.transfer') }}">
          @csrf
          <input type="hidden" name="account"      id="transfer-account">
          <input type="hidden" name="period_start" id="transfer-period-start">
          <input type="hidden" name="period_end"   id="transfer-period-end">
          <input type="hidden" name="line_ids"     id="transfer-ids">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Transfert de lignes</h5>
            </div>
            <div class="modal-body">
              <label>Transférer vers :</label>
              <select name="transfer_account" class="form-select" required>
                <option value="">-- Sélectionnez un compte --</option>
                @foreach($comptes as $c)
                  <option value="{{ $c->numero }}">{{ $c->numero }} – {{ $c->libelle }}</option>
                @endforeach
              </select>
              <div class="mt-2 text-end">
                <button type="button" class="btn btn-outline-primary"
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
		  <div class="modal-header">
			<h5 class="modal-title">Créer un compte</h5>
			<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
		  </div>
		  <form action="{{ route('comptes.store') }}" method="POST">
			@csrf
			<input type="hidden" name="preserve_line_ids"     id="preserve-line-ids">
			<input type="hidden" name="preserve_account"      id="preserve-account">
			<input type="hidden" name="preserve_period_start" id="preserve-period-start">
			<input type="hidden" name="preserve_period_end"   id="preserve-period-end">
			<div class="modal-body">
			  <div class="mb-3">
				<label class="form-label">Numéro</label>
				<input type="text"
					   name="numero"
					   value="{{ old('numero') }}"
					   class="form-control @error('numero') is-invalid @enderror"
					   required
					   pattern="\d{6}">
				@error('numero')
				  <div class="invalid-feedback">{{ $message }}</div>
				@enderror
			  </div>
			  <div class="mb-3">
				<label class="form-label">Libellé</label>
				<input type="text"
					   name="libelle"
					   value="{{ old('libelle') }}"
					   class="form-control @error('libelle') is-invalid @enderror"
					   required>
				@error('libelle')
				  <div class="invalid-feedback">{{ $message }}</div>
				@enderror
			  </div>
			</div>
			<div class="modal-footer">
			  <button type="button"
					  class="btn btn-secondary"
					  data-bs-dismiss="modal">
				Annuler
			  </button>
			  <button type="submit" class="btn btn-primary">
				Créer
			  </button>
			</div>
		  </form>
		</div>
	  </div>
	</div>


    {{-- Modal export --}}
	<div class="modal fade" id="exportModal" tabindex="-1" aria-hidden="true">
	  <div class="modal-dialog">
		<div class="modal-content"><!-- wrapper manquant -->
		  <form method="POST" action="{{ route('consult.grand_livre.export') }}">
			@csrf

			{{-- On transmet toujours le contexte du grand-livre --}}
			<input type="hidden" name="account"      id="export-account">
			<input type="hidden" name="period_start" id="export-period-start">
			<input type="hidden" name="period_end"   id="export-period-end">
			<input type="hidden" name="line_ids"     id="export-ids">

			<div class="modal-header">
			  <h5 class="modal-title">Export des lignes</h5>
			  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
			</div>

			<div class="modal-body">
			  <div class="form-check">
				<input class="form-check-input"
					   type="radio"
					   name="export_format"
					   id="fmtExcel"
					   value="excel"
					   checked>
				<label class="form-check-label" for="fmtExcel">Excel</label>
			  </div>
			  <div class="form-check">
				<input class="form-check-input"
					   type="radio"
					   name="export_format"
					   id="fmtPdf"
					   value="pdf">
				<label class="form-check-label" for="fmtPdf">PDF</label>
			  </div>
			</div>

			<div class="modal-footer">
			  <button type="button"
					  class="btn btn-secondary"
					  data-bs-dismiss="modal">
				Annuler
			  </button>
			  <button type="submit" class="btn btn-success">Exporter</button>
			</div>
		  </form>
		</div><!-- /.modal-content -->
	  </div><!-- /.modal-dialog -->
	</div><!-- /.modal -->
  </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  const table     = document.getElementById('gl-table');
  const tbody     = table.querySelector('tbody');
  const headers   = table.querySelectorAll('th');
  const selectAll = document.getElementById('select-all');
  const btnDel    = document.getElementById('btn-delete');
  const btnDup    = document.getElementById('btn-duplicate');
  const btnTrans  = document.getElementById('btn-transfer');
  const btnExp    = document.getElementById('btn-export');
  const delIds    = document.getElementById('delete-ids');
  const dupIds    = document.getElementById('duplicate-ids');
  const expIds    = document.getElementById('export-ids');
  const transIds  = document.getElementById('transfer-ids');
  const transferAccountInput = document.getElementById('transfer-account');
  const transferStartInput   = document.getElementById('transfer-period-start');
  const transferEndInput     = document.getElementById('transfer-period-end');
  const newCompte = @json(session('new_compte', ''));

  const transferModalEl = document.getElementById('transferModal');
  const transferSelect    = transferModalEl.querySelector('select[name="transfer_account"]');
  const createModalEl   = document.getElementById('createCompteModal');
  const exportAccountInput      = document.getElementById('export-account');
  const exportStartInput        = document.getElementById('export-period-start');
  const exportEndInput          = document.getElementById('export-period-end');
  const exportModalEl   = document.getElementById('exportModal');
  const transferModal   = new bootstrap.Modal(transferModalEl);
  const transferSelect  = transferModalEl.querySelector('select[name="transfer_account"]');
  const createModal     = new bootstrap.Modal(createModalEl);
  const exportModal     = new bootstrap.Modal(exportModalEl);

  // Sélection
  function anySelected() {
    return Array.from(tbody.querySelectorAll('.select-row')).some(cb => cb.checked);
  }
  function updateButtons() {
    const ok = anySelected();
    btnDel.disabled   = !ok;
    btnDup.disabled   = !ok;
    btnTrans.disabled = !ok;
    btnExp.disabled   = !ok;
  }
  selectAll.addEventListener('change', () => {
    tbody.querySelectorAll('.select-row').forEach(cb => cb.checked = selectAll.checked);
    updateButtons();
  });
  tbody.addEventListener('change', e => {
    if (e.target.matches('.select-row')) updateButtons();
  });

  // Remplir modals
  function collectIds() {
    return Array.from(tbody.querySelectorAll('.select-row'))
                .filter(cb=>cb.checked).map(cb=>cb.value).join(',');
  }
  document.getElementById('deleteModal').addEventListener('show.bs.modal', () => {
    delIds.value = collectIds();
  });
  document.getElementById('duplicateModal').addEventListener('show.bs.modal', () => {
    dupIds.value = collectIds();
  });
  document.getElementById('exportModal')
	  .addEventListener('show.bs.modal', () => {
		expIds.value               = collectIds();
		exportAccountInput.value   = '{{ $account }}';
		exportStartInput.value     = '{{ $start }}';
		exportEndInput.value       = '{{ $end }}';
	});
  transferModalEl.addEventListener('show.bs.modal', () => {
    transIds.value           = collectIds();
    transferAccountInput.value = '{{ $account }}';
    transferStartInput.value   = '{{ $start }}';
    transferEndInput.value     = '{{ $end }}';
	if (newCompte) {
        transferSelect.value = newCompte;
      }
  });
  createModalEl.addEventListener('show.bs.modal', ()=>{
    document.getElementById('preserve-line-ids').value     = collectIds();
    document.getElementById('preserve-account').value      = '{{ $account }}';
    document.getElementById('preserve-period-start').value = '{{ $start }}';
    document.getElementById('preserve-period-end').value   = '{{ $end }}';
  });
  document.querySelector('#exportModal form').addEventListener('submit', ()=> exportModal.hide());
  @if($errors->any())
    createModal.show();
  @endif
  createModalEl.addEventListener('hidden.bs.modal', ()=>{
    @if(! $errors->any())
      transferModal.show();
    @endif
  });
  @if(session('new_compte'))
    transferModal.show();
  @endif

  // Tri
   const parseDate = str => {
    const [d, m, y] = str.trim().split('/');
    return new Date(+y, +m - 1, +d);
  };

  // fonction de récupération de la valeur brute
  const getRaw = (row, idx) => row.children[idx].innerText.trim();

  // comparer spécial date pour la colonne Date (idx = 1), sinon numérique ou texte
  const comparer = (idx, asc) => (a, b) => {
    const va = getRaw(a, idx), vb = getRaw(b, idx);

    if (idx === 1) {
      // tri par date
      const dA = parseDate(va), dB = parseDate(vb);
      return asc ? dA - dB : dB - dA;
    }

    // essai numérique
    const nA = parseFloat(va.replace(/[^\d.-]/g, '')),
          nB = parseFloat(vb.replace(/[^\d.-]/g, ''));
    if (!isNaN(nA) && !isNaN(nB)) {
      return asc ? nA - nB : nB - nA;
    }

    // tri texte par défaut
    return asc
      ? va.localeCompare(vb)
      : vb.localeCompare(va);
  };

  headers.forEach((th, idx) => {
    if (idx === 0) return;           // on ignore la checkbox
    let asc = (idx === 1);           // tri initial asc pour la date, desc pour les autres
    const arrow = th.querySelector('.sort-arrow');
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      // remettre à plat les flèches
      headers.forEach(h => {
        const sp = h.querySelector('.sort-arrow');
        if (sp) sp.textContent = '';
      });
      // trier les lignes
      Array.from(tbody.querySelectorAll('tr'))
        .sort(comparer(idx, asc))
        .forEach(r => tbody.appendChild(r));
      // mettre la flèche
      arrow.textContent = asc ? '▲' : '▼';
      asc = !asc;

      // si vous avez une fonction updateCumul(), appelez-la ici
      if (typeof updateCumul === 'function') updateCumul();
    });
  });

  // Cumul
  function parseMontant(cell) {
    return parseFloat(cell.innerText.trim().replace(/\s/g,'').replace('€','').replace(',','.'))||0;
  }
  function formatFrench(n) {
    const p = n.toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return p.join(',')+' €';
  }
  function updateCumul() {
    let sum = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      sum += parseMontant(row.querySelector('.montant-cell'));
      row.querySelector('.cumul-cell').innerText = formatFrench(sum);
    });
  }
  // tri initial sur Date
  const dateHeader = headers[1];
  dateHeader.querySelector('.sort-arrow').textContent = '▲';
  const initialRows = Array.from(tbody.querySelectorAll('tr'));
  initialRows.sort(comparer(1, true)).forEach(r => tbody.appendChild(r));
  updateCumul();

  // édition in-page
  const actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
  const iframe      = document.getElementById('modal-iframe');
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', e => {
      if (e.target.closest('input[type=checkbox]')) return;
      iframe.src = row.dataset.editUrl;
      actionModal.show();
    });
  });
});
</script>
@endpush
