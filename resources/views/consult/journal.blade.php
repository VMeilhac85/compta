{{-- resources/views/consult/journal.blade.php --}}
@extends('layouts.app')

@section('content')
<style>
  /* Contrainte sur la hauteur de ligne + ellipsis */
  #journal-table td.truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

<div class="container">
  <div class="mx-auto" style="width:75%;">
    {{-- Titre --}}
    <h1 class="mb-4">Journal – {{ $journalCode }}</h1>

    {{-- Filtre Journal + Période --}}
    <form id="journal-form" method="GET" action="{{ route('ecritures.journal') }}" class="mb-3">
      <div class="row align-items-center g-3">
        <div class="col-auto d-flex align-items-center">
          <label class="fw-bold mb-0 me-2">Journal&nbsp;:</label>
          <select name="journal"
                  class="form-select form-select-sm me-4"
                  onchange="this.form.submit()">
            @foreach($journaux as $j)
              <option value="{{ $j->code }}"
                      {{ $j->code === $journalCode ? 'selected' : '' }}>
                {{ $j->code }} – {{ $j->name }}
              </option>
            @endforeach
          </select>

          <label class="fw-bold mb-0 me-2">Période&nbsp;:</label>
          <input type="date"
                 name="start"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 value="{{ $start }}">
          <span class="me-2">au</span>
          <input type="date"
                 name="end"
                 class="form-control form-control-sm me-2"
                 style="width:120px"
                 value="{{ $end }}">
          <button type="submit"
                  class="btn btn-primary btn-sm">
            Filtrer
          </button>
        </div>

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

    {{-- Tableau Journal --}}
    <table id="journal-table" class="table table-sm table-hover w-100">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>Num. Écr. <span class="sort-arrow"></span></th>
          <th>Date <span class="sort-arrow"></span></th>
          <th>Compte <span class="sort-arrow"></span></th>
          <th>Libellé <span class="sort-arrow"></span></th>
          <th>Commentaire <span class="sort-arrow"></span></th>
          <th class="text-end">Montant <span class="sort-arrow"></span></th>
        </tr>
      </thead>
      <tbody>
        @foreach($lignes as $ln)
          <tr data-edit-url="{{ route('ecritures.edit', $ln->num_ecriture) }}"
              data-num="{{ $ln->num_ecriture }}">
            <td>
              <input type="checkbox"
                     class="select-row"
                     value="{{ $ln->line_id }}">
            </td>
            <td>{{ $ln->num_ecriture }}</td>
            <td>{{ \Carbon\Carbon::createFromFormat('Y-m-d', $ln->date_iso)->format('d/m/Y') }}</td>
            <td>{{ $ln->compte }}</td>
            <td class="truncate">{{ $ln->libelle }}</td>
            <td class="truncate">{{ $ln->commentaire }}</td>
            <td class="truncate text-end montant-cell">
              {{ number_format($ln->montant,2,',',' ') }} €
            </td>
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
        <form method="POST" action="{{ route('consult.journal.delete') }}">
          @csrf
          <input type="hidden" name="journal"  value="{{ $journalCode }}">
          <input type="hidden" name="start"    value="{{ $start }}">
          <input type="hidden" name="end"      value="{{ $end }}">
          <input type="hidden" name="line_ids" id="delete-ids">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirmer la suppression</h5>
            </div>
            <div class="modal-body">
              Supprimer intégralement les écritures pour les lignes sélectionnées ?
            </div>
            <div class="modal-footer">
              <button type="button"
                      class="btn btn-secondary"
                      data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="submit" class="btn btn-danger">Supprimer</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {{-- Modal duplication --}}
    <div class="modal fade" id="duplicateModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form method="POST" action="{{ route('consult.journal.duplicate') }}">
          @csrf
          <input type="hidden" name="journal"   value="{{ $journalCode }}">
          <input type="hidden" name="start"     value="{{ $start }}">
          <input type="hidden" name="end"       value="{{ $end }}">
          <input type="hidden" name="line_ids"  id="duplicate-ids">
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
              <button type="button"
                      class="btn btn-secondary"
                      data-bs-dismiss="modal">
                Annuler
              </button>
              <button type="submit" class="btn btn-secondary">Dupliquer</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    {{-- Modal transfert --}}
    <div class="modal fade" id="transferModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <form method="POST" action="{{ route('consult.journal.transfer') }}">
		  @csrf

		  {{-- Contexte conservé --}}
		  <input type="hidden" name="journal"   id="transfer-journal"  value="{{ $journalCode }}">
		  <input type="hidden" name="start"     id="transfer-start"    value="{{ $start }}">
		  <input type="hidden" name="end"       id="transfer-end"      value="{{ $end }}">
		  <input type="hidden" name="line_ids"  id="transfer-ids">

		  <div class="modal-content">
			<div class="modal-header">
			  <h5 class="modal-title">Changer de journal</h5>
			</div>
			<div class="modal-body">
			  <label for="transfer-journal-select">Vers :</label>
			  <select name="transfer_journal"
					  id="transfer-journal-select"
					  class="form-select"
					  required>
				<option value="">-- Sélectionnez un journal --</option>
				@foreach($journaux as $j)
				  <option value="{{ $j->code }}">{{ $j->code }} – {{ $j->name }}</option>
				@endforeach
			  </select>
			</div>
			<div class="modal-footer">
			  <button type="button"
					  class="btn btn-secondary"
					  data-bs-dismiss="modal">
				Annuler
			  </button>
			  <button type="submit" class="btn btn-warning">
				Transférer
			  </button>
			</div>
		  </div>
		</form>
      </div>
    </div>

    {{-- Modal création de compte --}}
    <div class="modal fade" id="createCompteModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form action="{{ route('comptes.store') }}" method="POST">
            @csrf
            <input type="hidden" name="preserve_line_ids" id="preserve-line-ids">
            <input type="hidden" name="preserve_journal"  id="preserve-journal">
            <input type="hidden" name="preserve_start"    id="preserve-start">
            <input type="hidden" name="preserve_end"      id="preserve-end">
            <div class="modal-header">
              <h5 class="modal-title">Créer un compte</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Numéro</label>
                <input type="text"
                       name="numero"
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
              <button type="submit" class="btn btn-primary">Créer</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    {{-- Modal Export --}}
    <div class="modal fade" id="exportModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
		  <form method="POST" action="{{ route('consult.journal.export') }}">
			@csrf
			<input type="hidden" name="journal"   id="export-journal">
			<input type="hidden" name="start"     id="export-start">
			<input type="hidden" name="end"       id="export-end">
			<input type="hidden" name="line_ids"  id="export-ids">

			<div class="modal-content">
			  <div class="modal-header">
				<h5 class="modal-title">Export des lignes</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
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

  </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  const table        = document.getElementById('journal-table');
  const tbody        = table.querySelector('tbody');
  const headers      = table.querySelectorAll('th');
  const selectAll    = document.getElementById('select-all');
  const btnDelete    = document.getElementById('btn-delete');
  const btnDup       = document.getElementById('btn-duplicate');
  const btnTrans     = document.getElementById('btn-transfer');
  const btnExport    = document.getElementById('btn-export');
  const delIds       = document.getElementById('delete-ids');
  const dupIds       = document.getElementById('duplicate-ids');
  const expIds       = document.getElementById('export-ids');
  const transIds     = document.getElementById('transfer-ids');
  const transferJ    = document.getElementById('transfer-journal');
  const transferSt   = document.getElementById('transfer-start');
  const transferEn   = document.getElementById('transfer-end');
  const exportJ      = document.getElementById('export-journal');
  const exportSt     = document.getElementById('export-start');
  const exportEn     = document.getElementById('export-end');
  const preserveIds  = document.getElementById('preserve-line-ids');
  const preserveJ    = document.getElementById('preserve-journal');
  const preserveSt   = document.getElementById('preserve-start');
  const preserveEn   = document.getElementById('preserve-end');
  const journalCode  = @json($journalCode);
  const start        = @json($start);
  const end          = @json($end);

  function anySelected() {
    return Array.from(tbody.querySelectorAll('.select-row')).some(cb => cb.checked);
  }
  function updateButtons() {
    const ok = anySelected();
    [btnDelete, btnDup, btnTrans, btnExport].forEach(b => b.disabled = !ok);
  }
  selectAll.addEventListener('change', () => {
    tbody.querySelectorAll('.select-row').forEach(cb => cb.checked = selectAll.checked);
    updateButtons();
  });
  
  tbody.addEventListener('change', e => {
	  if (!e.target.matches('.select-row')) return;

	  const checked = e.target.checked;
	  // Numéro d’écriture de la ligne cliquée
	  const num = e.target.closest('tr').dataset.num;

	  // Pour chaque checkbox dont la ligne a le même data-num
	  tbody.querySelectorAll(`tr[data-num="${num}"] .select-row`)
		   .forEach(cb => cb.checked = checked);

	  updateButtons();
	});
	  
  tbody.addEventListener('change', e => {
    if (e.target.matches('.select-row')) updateButtons();
  });

  function collectIds() {
    return Array.from(tbody.querySelectorAll('.select-row'))
                .filter(cb => cb.checked)
                .map(cb => cb.value)
                .join(',');
  }

  // Préparer modals
  document.getElementById('deleteModal').addEventListener('show.bs.modal', () => {
    delIds.value = collectIds();
  });
  document.getElementById('duplicateModal').addEventListener('show.bs.modal', () => {
    dupIds.value = collectIds();
  });
  document.getElementById('transferModal').addEventListener('show.bs.modal', () => {
    transIds.value    = collectIds();
    transferJ.value   = journalCode;
    transferSt.value  = start;
    transferEn.value  = end;
  });
  document.getElementById('exportModal').addEventListener('show.bs.modal', () => {
    expIds.value    = collectIds();
    exportJ.value   = journalCode;
    exportSt.value  = start;
    exportEn.value  = end;
  });

  // Pré-remplir createCompteModal
  const createModalEl = document.getElementById('createCompteModal');
  createModalEl.addEventListener('show.bs.modal', () => {
    preserveIds.value = collectIds();
    preserveJ.value   = journalCode;
    preserveSt.value  = start;
    preserveEn.value  = end;
  });
  // Rouvrir transferModal après création de compte
  @if(session('new_compte'))
    const tModal = new bootstrap.Modal(document.getElementById('transferModal'));
    tModal.show();
    document.querySelector('#transferModal select').value = "{{ session('new_compte') }}";
  @endif

  // Tri et cumul
  const getVal = (row, idx) => row.children[idx].innerText.trim().replace(/\s|€/g,'').replace(',','.');
  const parseDate = txt => {
    const [d,m,y] = txt.split('/');
    return new Date(`${y}-${m}-${d}`);
  };
  function comparer(idx, asc) {
    return (a,b) => {
      if (idx === 2) { // Date
        const dA = parseDate(a.children[2].innerText);
        const dB = parseDate(b.children[2].innerText);
        if (dA.getTime() === dB.getTime()) {
          const nA = parseInt(a.dataset.num), nB = parseInt(b.dataset.num);
          return asc ? nA - nB : nB - nA;
        }
        return asc ? dA - dB : dB - dA;
      }
      const vA = parseFloat(getVal(a, idx)), vB = parseFloat(getVal(b, idx));
      if (!isNaN(vA) && !isNaN(vB)) return asc ? vA - vB : vB - vA;
      return asc ? getVal(a, idx).localeCompare(getVal(b, idx))
                 : getVal(b, idx).localeCompare(getVal(a, idx));
    };
  }
  headers.forEach((th, idx) => {
    if (idx === 0) return;
    let asc = (idx !== 1);
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      headers.forEach(h => { const sp = h.querySelector('.sort-arrow'); if (sp) sp.textContent = ''; });
      Array.from(tbody.querySelectorAll('tr'))
           .sort(comparer(idx, asc))
           .forEach(r => tbody.appendChild(r));
      th.querySelector('.sort-arrow').textContent = asc ? '▲' : '▼';
      asc = !asc;
	  stripeGroups();
    });
  });

  function formatFrench(n) {
    const p = n.toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    return p.join(',') + ' €';
  }
  
  function stripeGroups() {
	  let prev = null, odd = false;
	  document.querySelectorAll('#journal-table tbody tr').forEach(row => {
		const num = row.dataset.num;
		if (num !== prev) odd = !odd;
		row.classList.toggle('table-secondary', odd);
		prev = num;
	  });
	}

  // Tri initial par Num. Ècr. desc
  const initRows = Array.from(tbody.querySelectorAll('tr'));
  initRows.sort((a,b) => parseInt(b.dataset.num) - parseInt(a.dataset.num))
          .forEach(r => tbody.appendChild(r));
  headers[1].querySelector('.sort-arrow').textContent = '▼';
  stripeGroups();

  // Edition in-page
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
