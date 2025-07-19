@extends('layouts.app')

@section('content')
<div class="container">
  <h1 class="mb-4">Rechercher des écritures</h1>

  {{-- Formulaire de recherche --}}
  <form method="GET" action="{{ route('consult.search') }}" class="mb-4">
    <div class="row gx-3 gy-3 align-items-end">
      {{-- Date minimum --}}
      <div class="col-md-2">
        <label class="form-label">Date minimum</label>
        <input type="date" name="date_min" class="form-control"
               value="{{ old('date_min', $dateMin ?? '') }}">
      </div>
      {{-- Date maximum --}}
      <div class="col-md-2">
        <label class="form-label">Date maximum</label>
        <input type="date" name="date_max" class="form-control"
               value="{{ old('date_max', $dateMax ?? '') }}">
      </div>
      {{-- Montant minimum --}}
      <div class="col-md-2">
        <label class="form-label">Montant minimum</label>
        <input type="text" name="montant_min" class="form-control montant-input" placeholder="Montant"
               value="{{ old('montant_min', $montantMin ?? '') }}">
      </div>
      {{-- Montant maximum --}}
      <div class="col-md-2">
        <label class="form-label">Montant maximum</label>
        <input type="text" name="montant_max" class="form-control montant-input" placeholder="Montant"
               value="{{ old('montant_max', $montantMax ?? '') }}">
      </div>
      {{-- Libellé écriture --}}
      <div class="col-md-4">
        <label class="form-label">Libellé écriture</label>
        <input type="text" name="libelle" class="form-control"
               value="{{ old('libelle', $libelle ?? '') }}">
      </div>
      {{-- Commentaire ligne --}}
      <div class="col-md-4">
        <label class="form-label">Commentaire ligne</label>
        <input type="text" name="commentaire" class="form-control"
               value="{{ old('commentaire', $commentaire ?? '') }}">
      </div>
      {{-- Journal --}}
      <div class="col-md-3">
        <label class="form-label">Journal</label>
        <select name="journal" class="form-select">
          <option value="">-- Tous --</option>
          @foreach($journaux as $j)
            <option value="{{ $j->code }}"
              {{ (old('journal', $journalCode ?? '') === $j->code) ? 'selected' : '' }}>
              {{ $j->code }} – {{ $j->name }}
            </option>
          @endforeach
        </select>
      </div>
      {{-- Comptes (dropdown avec cases à cocher) --}}
      <div class="col-md-3">
        <label class="form-label">Comptes</label>
        @php
          $allNums = $comptes->pluck('numero')->toArray();
          $selNums = old('compte', request('compte', $allNums));
          if (!is_array($selNums) || empty($selNums)) {
            $selNums = $allNums;
          }
        @endphp
        <div class="dropdown">
          <button class="btn btn-outline-secondary dropdown-toggle w-100 text-start"
                  type="button" id="dropdownComptes" data-bs-toggle="dropdown"
                  aria-expanded="false">
            {{ count($selNums) === count($allNums)
                ? 'Tous les comptes'
                : count($selNums).' compte'.(count($selNums)>1?'s sélectionnés':' sélectionné')
            }}
          </button>
          <ul class="dropdown-menu p-2" aria-labelledby="dropdownComptes" style="max-height:250px;overflow:auto;">
			  <li class="form-check mb-2">
				<input class="form-check-input" type="checkbox" id="compte-select-all">
				<label class="form-check-label small" for="compte-select-all">
				  Sélectionner tous les comptes
				</label>
			  </li>
            @foreach($comptes as $c)
              <li class="form-check">
                <input class="form-check-input compte-checkbox"
                       type="checkbox"
                       value="{{ $c->numero }}"
                       id="compte-{{ $c->numero }}"
                       {{ in_array($c->numero, $selNums) ? 'checked' : '' }}>
                <label class="form-check-label small" for="compte-{{ $c->numero }}">
                  {{ $c->numero }} – {{ $c->libelle }}
                </label>
              </li>
            @endforeach
          </ul>
        </div>
        <div id="hidden-comptes">
          @foreach($selNums as $num)
            <input type="hidden" name="compte[]" value="{{ $num }}">
          @endforeach
        </div>
      </div>
      {{-- Bouton Rechercher --}}
      <div class="col-md-2 d-grid">
        <button type="submit" class="btn btn-primary">Rechercher</button>
      </div>
    </div>
  </form>

  @if(isset($lignes))
    {{-- Boutons bulk actions --}}
    <div class="mb-2">
      <button id="btn-delete"    class="btn btn-danger btn-sm me-2" data-bs-toggle="modal" data-bs-target="#deleteModal"    disabled>Suppression</button>
      <button id="btn-duplicate" class="btn btn-secondary btn-sm me-2" data-bs-toggle="modal" data-bs-target="#duplicateModal" disabled>Duplication</button>
      <button id="btn-transfer"  class="btn btn-warning btn-sm me-2" data-bs-toggle="modal" data-bs-target="#transferModal"  disabled>Transfert</button>
      <button id="btn-export"    class="btn btn-success btn-sm"      data-bs-toggle="modal" data-bs-target="#exportModal"    disabled>Export</button>
    </div>

    {{-- Nombre de résultats --}}
    <h5>{{ $lignes->count() }} résultat{{ $lignes->count() > 1 ? 's' : '' }}</h5>

    {{-- Tableau des résultats --}}
    <table id="search-table" class="table table-sm table-striped">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all"></th>
          <th>Date <span class="sort-arrow"></span></th>
          <th>Journal <span class="sort-arrow"></span></th>
          <th>N°Écr. <span class="sort-arrow"></span></th>
          <th>Compte <span class="sort-arrow"></span></th>
          <th>Libellé <span class="sort-arrow"></span></th>
          <th>Commentaire <span class="sort-arrow"></span></th>
          <th class="text-end">Montant <span class="sort-arrow"></span></th>
        </tr>
      </thead>
      <tbody>
        @foreach($lignes as $ln)
          <tr
            class="clickable-row"
            data-num="{{ $ln->num_ecriture }}"
            data-edit-url="{{ route('ecritures.edit', $ln->num_ecriture) }}"
          >
            <td><input type="checkbox" class="select-row" value="{{ $ln->line_id }}"></td>
            <td>{{ \Carbon\Carbon::parse($ln->date_iso)->format('d/m/Y') }}</td>
            <td>{{ $ln->journal }}</td>
            <td>{{ $ln->num_ecriture }}</td>
            <td>{{ $ln->compte }}</td>
            <td>{{ $ln->libelle_ecriture }}</td>
            <td>{{ $ln->commentaire }}</td>
            <td class="text-end">{{ number_format($ln->montant,2,',',' ') }} €</td>
          </tr>
        @endforeach
      </tbody>
    </table>
  @endif
</div>

{{-- Modal Suppression --}}
<div class="modal fade" id="deleteModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('consult.search.delete') }}">
      @csrf
      {{-- Repasser les filtres --}}
      <input type="hidden" name="date_min"    value="{{ request('date_min') }}">
      <input type="hidden" name="date_max"    value="{{ request('date_max') }}">
      <input type="hidden" name="montant_min" value="{{ request('montant_min') }}">
      <input type="hidden" name="montant_max" value="{{ request('montant_max') }}">
      <input type="hidden" name="libelle"     value="{{ request('libelle') }}">
      <input type="hidden" name="commentaire" value="{{ request('commentaire') }}">
      <input type="hidden" name="journal"     value="{{ request('journal') }}">
      @foreach(request('compte', []) as $cp)
        <input type="hidden" name="compte[]" value="{{ $cp }}">
      @endforeach
      <input type="hidden" name="line_ids" id="delete-ids">
      <div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Confirmer la suppression</h5></div>
        <div class="modal-body">Supprimer toutes les écritures associées aux lignes sélectionnées ?</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button type="submit" class="btn btn-danger">Supprimer</button>
        </div>
      </div>
    </form>
  </div>
</div>

{{-- Modal Duplication --}}
<div class="modal fade" id="duplicateModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('consult.search.duplicate') }}">
      @csrf
      {{-- Repasser les filtres --}}
      <input type="hidden" name="date_min"    value="{{ request('date_min') }}">
      <input type="hidden" name="date_max"    value="{{ request('date_max') }}">
      <input type="hidden" name="montant_min" value="{{ request('montant_min') }}">
      <input type="hidden" name="montant_max" value="{{ request('montant_max') }}">
      <input type="hidden" name="libelle"     value="{{ request('libelle') }}">
      <input type="hidden" name="commentaire" value="{{ request('commentaire') }}">
      <input type="hidden" name="journal"     value="{{ request('journal') }}">
      @foreach(request('compte', []) as $cp)
        <input type="hidden" name="compte[]" value="{{ $cp }}">
      @endforeach
      <input type="hidden" name="line_ids" id="duplicate-ids">
      <div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Duplication</h5></div>
        <div class="modal-body">
          <label for="duplicate_date">Date cible :</label>
          <input type="date" name="duplicate_date" id="duplicate_date" class="form-control" value="{{ now()->format('Y-m-d') }}" required>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
          <button type="submit" class="btn btn-secondary">Dupliquer</button>
        </div>
      </div>
    </form>
  </div>
</div>

{{-- Modal Transfert --}}
<div class="modal fade" id="transferModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('consult.search.transfer') }}">
      @csrf
      {{-- Repasser les filtres --}}
      <input type="hidden" name="date_min"    value="{{ request('date_min') }}">
      <input type="hidden" name="date_max"    value="{{ request('date_max') }}">
      <input type="hidden" name="montant_min" value="{{ request('montant_min') }}">
      <input type="hidden" name="montant_max" value="{{ request('montant_max') }}">
      <input type="hidden" name="libelle"     value="{{ request('libelle') }}">
      <input type="hidden" name="commentaire" value="{{ request('commentaire') }}">
      <input type="hidden" name="journal"     value="{{ request('journal') }}">
      @foreach(request('compte', []) as $cp)
        <input type="hidden" name="compte[]" value="{{ $cp }}">
      @endforeach
      <input type="hidden" name="line_ids" id="transfer-ids">
      <div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Transfert de lignes</h5></div>
        <div class="modal-body">
          <label for="transfer_account">Vers le compte :</label>
          <select name="transfer_account" id="transfer_account" class="form-select" required>
            <option value="">-- Sélectionnez un compte --</option>
            @foreach($comptes as $c)
              <option value="{{ $c->numero }}">{{ $c->numero }} – {{ $c->libelle }}</option>
            @endforeach
          </select>
          <div class="mt-2 text-end">
            <button type="button" class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#createCompteModal">+ Créer un compte</button>
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

{{-- Modal Export --}}
<div class="modal fade" id="exportModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <form method="POST" action="{{ route('consult.search.export') }}">
      @csrf
      {{-- Repasser les filtres --}}
      <input type="hidden" name="date_min"    value="{{ request('date_min') }}">
      <input type="hidden" name="date_max"    value="{{ request('date_max') }}">
      <input type="hidden" name="montant_min" value="{{ request('montant_min') }}">
      <input type="hidden" name="montant_max" value="{{ request('montant_max') }}">
      <input type="hidden" name="libelle"     value="{{ request('libelle') }}">
      <input type="hidden" name="commentaire" value="{{ request('commentaire') }}">
      <input type="hidden" name="journal"     value="{{ request('journal') }}">
      @foreach(request('compte', []) as $cp)
        <input type="hidden" name="compte[]" value="{{ $cp }}">
      @endforeach
      <input type="hidden" name="line_ids" id="export-ids">  
      <div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Export des lignes</h5></div>
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

{{-- Modal Création de compte --}}
<div class="modal fade" id="createCompteModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <form action="{{ route('comptes.store') }}" method="POST">
        @csrf
        <input type="hidden" name="preserve_url" value="{{ url()->full() }}">
        <div class="modal-header"><h5 class="modal-title">Créer un compte</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Numéro</label>
            <input type="text" name="numero" class="form-control" required pattern="\d{6}" title="6 chiffres exacts">
          </div>
          <div class="mb-3">
            <label class="form-label">Libellé</label>
            <input type="text" name="libelle" class="form-control" required>
          </div>
        </div>
        <div class="modal-footer"><button class="btn btn-primary">Créer le compte</button></div>
      </form>
    </div>
  </div>
</div>

{{-- Modal Édition in‑page --}}
<div class="modal fade" id="actionModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl">
    <div class="modal-content" style="height:calc(100vh - 3rem);">
      <div class="modal-header"><h5 class="modal-title">Modifier l’écriture</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body p-0" style="flex:1 1 auto; overflow:hidden;">
        <iframe id="modal-iframe" style="width:100%;height:100%;border:none;"></iframe>
      </div>
    </div>
  </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  // ===== Dropdown Comptes =====
  const dropdownBtn   = document.getElementById('dropdownComptes');
  const checkboxes    = document.querySelectorAll('.compte-checkbox');
  const hiddenDiv     = document.getElementById('hidden-comptes');
  const allValues     = Array.from(checkboxes).map(cb=>cb.value);
  const selectAllCb = document.getElementById('compte-select-all');
  const compteCbs  = document.querySelectorAll('.compte-checkbox');

  function updateComptes() {
    // 1) Liste des comptes cochés
    const sel = Array.from(checkboxes)
                     .filter(cb => cb.checked)
                     .map(cb => cb.value);

    // 2) Mise à jour du label du bouton
    if (sel.length === 0) {
      dropdownBtn.textContent = 'Aucun compte';
    }
    else if (sel.length === allValues.length) {
      dropdownBtn.textContent = 'Tous les comptes';
    }
    else if (sel.length === 1) {
      // on cherche la case cochée et son label
      const cb = document.querySelector(`.compte-checkbox[value="${sel[0]}"]`);
      const labelText = cb.nextElementSibling.innerText.trim();
      dropdownBtn.textContent = labelText;
    }
    else {
      dropdownBtn.textContent = sel.length + ' comptes sélectionnés';
    }

    // 3) Recréer les champs hidden
    hiddenDiv.innerHTML = sel.map(v =>
      `<input type="hidden" name="compte[]" value="${v}">`
    ).join('');

    // 4) (optionnel) synchroniser "Tous sélectionner"
    if (selectAllCb) {
      selectAllCb.checked = (sel.length === allValues.length);
    }
  }
	checkboxes.forEach(cb => cb.addEventListener('change', updateComptes));
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      const check = selectAllCb.checked;
      checkboxes.forEach(cb => cb.checked = check);
      updateComptes();
    });
  }
  updateComptes();
  
  function syncSelectAll() {
		// coche "Tous" si toutes cochées, décoche sinon
		selectAllCb.checked = Array.from(compteCbs).every(cb => cb.checked);
	  }

	  // Quand on clique sur "Tous sélectionner"
	  selectAllCb.addEventListener('change', () => {
		compteCbs.forEach(cb => cb.checked = selectAllCb.checked);
		updateComptes(); // votre fonction existante qui rebuild hidden inputs & label
	  });

	  // Quand on coche/décoche un compte individuel
	  compteCbs.forEach(cb => {
		cb.addEventListener('change', () => {
		  syncSelectAll();
		  updateComptes();
		});
	  });

	// Initialisation au chargement
	syncSelectAll();

  // ===== Format Montants =====
  function formatMontant(el) {
    const raw = el.value.replace(/\./g, ',');
    const cur = el.selectionStart;
    const left = raw.slice(0, cur);
    const sig = (left.match(/[\d,]/g)||[]).length;
    let tmp = raw.replace(/[^\d,,-]/g,'').replace(/,/g,'.');
    const neg = tmp.startsWith('-') ? '-' : '';
    tmp = tmp.replace(/^-/, '');
    let [i,d] = tmp.split('.');
    d = (d||'').slice(0,2);
    i = i.replace(/^0+/,'')||'0';
    const spaced = i.replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    const justSep = raw[cur-1]===',';
    let out = justSep ? `${neg}${spaced}, €`
            : d.length   ? `${neg}${spaced},${d} €`
                         : `${neg}${spaced} €`;
    el.value = out;
    let count=0, pos=out.length-2;
    for (let k=0;k<out.length;k++){
      if (/[\d,]/.test(out[k])) count++;
      if (count>=sig){ pos=k+1; break; }
    }
    el.setSelectionRange(pos,pos);
  }
  document.querySelectorAll('.montant-input').forEach(i=>i.addEventListener('input',()=>formatMontant(i)));

  // ===== Table tri, selection bulk, propagation lignes =====
  const table     = document.getElementById('search-table');
  if (!table) return;
  const tbody     = table.querySelector('tbody');
  const headers   = table.querySelectorAll('th');
  const selectAll = document.getElementById('select-all');
  const btns      = ['delete','duplicate','transfer','export'].map(id=>document.getElementById(`btn-${id}`));

  function updateBulkButtons(){
    const any = Array.from(tbody.querySelectorAll('.select-row')).some(cb=>cb.checked);
    btns.forEach(b=>b.disabled = !any);
  }

  // Selection propagation par écriture
  tbody.addEventListener('change', e=>{
    if (!e.target.matches('.select-row')) return;
    const tr = e.target.closest('tr');
    tbody.querySelectorAll(`tr[data-num="${tr.dataset.num}"] .select-row`)
         .forEach(cb=>cb.checked = e.target.checked);
    updateBulkButtons();
  });
  selectAll.addEventListener('change', ()=>{
    tbody.querySelectorAll('.select-row').forEach(cb=>cb.checked = selectAll.checked);
    updateBulkButtons();
  });

  // collect IDs for modals
  function collect(){
    return Array.from(tbody.querySelectorAll('.select-row'))
      .filter(cb=>cb.checked).map(cb=>cb.value).join(',');
  }
  ['delete','duplicate','transfer','export'].forEach(action=>{
    document.getElementById(`${action}Modal`)
      .addEventListener('show.bs.modal',()=>{
        document.getElementById(`${action}-ids`).value = collect();
      });
  });

  // Tri des colonnes
  function parseDate(txt){ const [d,m,y]=txt.split('/'); return new Date(y,m-1,d); }
  function getText(r,i){ return r.children[i].innerText.trim(); }
  function comparer(i,asc){
    return (a,b)=>{
      let va=getText(a,i), vb=getText(b,i), res;
      if (i===1)      res = parseDate(va)-parseDate(vb);
      else if (i===7) res = parseFloat(va.replace(/\s|€|,/g,'')) - parseFloat(vb.replace(/\s|€|,/g,''));
      else if (i===3||i===4) res = parseInt(va) - parseInt(vb);
      else             res = va.localeCompare(vb);
      return asc ? res : -res;
    };
  }
  headers.forEach((th,i)=>{
    th.style.cursor='pointer';
    let asc = (i===1);
    th.addEventListener('click',()=>{
      headers.forEach(h=>{const s=h.querySelector('.sort-arrow'); if(s) s.textContent='';});
      Array.from(tbody.querySelectorAll('tr')).sort(comparer(i,asc))
           .forEach(r=>tbody.appendChild(r));
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) arrow.textContent = asc?'▲':'▼';
      asc = !asc;
    });
  });
  headers[1].click();

  // Edition in‑page
  const actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
  const iframe = document.getElementById('modal-iframe');
  tbody.querySelectorAll('.clickable-row').forEach(row=>{
    row.style.cursor='pointer';
    row.addEventListener('click', e=>{
      if(e.target.closest('input,select,button')) return;
      iframe.src = row.dataset.editUrl;
      actionModal.show();
    });
  });
});
</script>
@endpush
