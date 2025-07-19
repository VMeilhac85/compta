@extends('layouts.app')

@section('content')
<div class="container">
  {{-- En-tête --}}
  <div class="d-flex justify-content-between align-items-center mb-4">
    <div class="d-flex align-items-center">
      <h1 class="me-3 mb-0">Nouvelle écriture</h1>
      <div id="notification-space" class="d-flex flex-column" style="min-height:2rem;">
		  {{-- Succès de création d’écriture --}}
		  @if(session('success'))
			<div id="success-alert"
				 class="alert alert-success mb-0"
				 style="min-height:2rem; transition: opacity 0.5s, visibility 0s linear 0.5s;">
			  {{ session('success') }}
			</div>
		  @endif

		  {{-- Succès de création de compte --}}
		  @if(session('accountSuccess'))
			<div id="account-success-alert"
				 class="alert alert-success mb-0"
				 style="min-height:2rem; transition: opacity 0.5s, visibility 0s linear 0.5s;">
			  {{ session('accountSuccess') }}
			</div>
		  @endif

		  <div id="sum-error"
			   class="alert alert-danger d-none mb-0"
			   style="min-height:2rem;"></div>
		</div>
    </div>
    <a href="{{ route('home') }}" class="btn btn-secondary">Retour</a>
  </div>

  {{-- Formulaire de création --}}
  <form id="ecriture-form" action="{{ route('ecritures.store') }}" method="POST">
    @csrf

    <h4>Informations de l’écriture</h4>
    <div class="row mb-3 align-items-center">
      <div class="col-md-4">
        <select name="journal" id="journal"
                class="form-select @error('journal') is-invalid @enderror"
                required>
          <option value="">-- Journal --</option>
          @foreach($journaux as $j)
            <option value="{{ $j->code }}"
              {{ old('journal', $dernierJournal) === $j->code ? 'selected' : '' }}>
              {{ $j->code }} – {{ $j->name }}
            </option>
          @endforeach
        </select>
        @error('journal')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
      <div class="col-md-2">
        <input type="text" name="date" id="date"
               class="form-control @error('date') is-invalid @enderror"
               value="{{ old('date', now()->format('d/m/Y')) }}"
               required>
        @error('date')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
      <div class="col-md-6">
        <input type="text" name="label" id="label"
               class="form-control @error('label') is-invalid @enderror"
               placeholder="Libellé"
               value="{{ old('label') }}"
               required>
        @error('label')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
    </div>

    {{-- Lignes + bouton création compte --}}
    <div class="d-flex justify-content-between align-items-center mt-4 mb-2">
      <h4 class="mb-0">Lignes</h4>
      <button type="button"
              class="btn btn-sm btn-outline-primary"
              data-bs-toggle="modal"
              data-bs-target="#createCompteModal">
        Créer un compte
      </button>
    </div>

    <div id="lignes-container">
      @php
        $old   = old('lignes', []);
        $count = max(2, count($old));
      @endphp

      @for($i = 0; $i < $count; $i++)
        @php
          $val = $old[$i] ?? [];
          $sel = $val['compte'] ?? '';
        @endphp
        <div class="row mb-3 align-items-center ligne-row" data-index="{{ $i }}">
          <div class="col-md-4">
            <select name="lignes[{{ $i }}][compte]"
                    class="form-select compte-select @error('lignes.'.$i.'.compte') is-invalid @enderror"
                    required>
              <option value="">Compte…</option>
              @foreach($comptes as $c)
                <option value="{{ $c->numero }}"
                  {{ (string)$c->numero === (string)$sel ? 'selected' : '' }}>
                  {{ $c->numero }} – {{ $c->libelle }}
                </option>
              @endforeach
            </select>
            @error('lignes.'.$i.'.compte')
              <div class="invalid-feedback">{{ $message }}</div>
            @enderror
          </div>
          <div class="col-md-2">
            <input type="text"
                   name="lignes[{{ $i }}][montant]"
                   class="form-control montant-input @error('lignes.'.$i.'.montant') is-invalid @enderror"
                   placeholder="Montant"
                   value="{{ $val['montant'] ?? '' }}"
                   required>
            @error('lignes.'.$i.'.montant')
              <div class="invalid-feedback">{{ $message }}</div>
            @enderror
          </div>
          <div class="col-md-5">
            <input type="text"
                   name="lignes[{{ $i }}][commentaire]"
                   class="form-control"
                   placeholder="Commentaire"
                   value="{{ $val['commentaire'] ?? '' }}">
          </div>
          <div class="col-md-1 text-end">
            <button type="button" class="btn btn-danger remove-ligne">×</button>
          </div>
        </div>
      @endfor
    </div>

    <button id="add-ligne" type="button" class="btn btn-outline-secondary mb-3">
      + Ajouter une ligne
    </button>

    <div class="mt-4">
      <button type="submit" class="btn btn-primary">Enregistrer l'écriture</button>
    </div>
  </form>

  {{-- Historique --}}
  <div class="mt-5">
    <h4>{{ $limit }} dernières écritures créées</h4>
    <form method="GET" action="{{ route('ecritures.create') }}"
          class="mb-3 d-flex align-items-center">
      <label for="limit" class="me-2 mb-0">Nombre :</label>
      <input type="number" id="limit" name="limit"
             value="{{ $limit }}" min="1"
             class="form-control me-2" style="width:80px;">
      <button type="submit" class="btn btn-sm btn-secondary">Afficher</button>
    </form>
    <ul class="list-group">
      @foreach($historique as $e)
        <li class="list-group-item écriture-item"
            style="cursor:pointer"
            data-edit-url="{{ route('ecritures.edit', $e) }}">
          <div class="d-flex align-items-center">
            <div class="flex-grow-1 me-3"
                 style="overflow-x:auto; white-space:nowrap;">
              <strong>{{ $e->journal }} – {{ $e->date }} – {{ $e->label }} |</strong>
              @foreach($e->lignes()->get() as $ligne)
                <span class="ms-3">
                  {{ $ligne->compte }} :
                  {{ number_format($ligne->montant, 2, ',', ' ') }} €
                </span>
              @endforeach
            </div>
          </div>
        </li>
      @endforeach
    </ul>
  </div>
</div>

{{-- Modals --}}
<div class="modal fade" id="actionModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl">
    <div class="modal-content" style="height:calc(100vh - 3rem);">
      <div class="modal-header">
        <h5 class="modal-title">Modifier l’écriture</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body p-0" style="flex:1 1 auto; overflow:hidden;">
        <iframe id="modal-iframe" style="width:100%; height:100%; border:none;"></iframe>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="createCompteModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Créer un compte</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <form action="{{ route('comptes.store') }}" method="POST">
		<input type="hidden" name="preserve_url" value="{{ url()->full() }}">
        @csrf
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Numéro</label>
            <input type="text" name="numero"
                   class="form-control @error('numero') is-invalid @enderror"
                   required pattern="\d{6}" title="6 chiffres exacts">
            @error('numero')<div class="invalid-feedback">{{ $message }}</div>@enderror
          </div>
          <div class="mb-3">
            <label class="form-label">Libellé</label>
            <input type="text" name="libelle"
                   class="form-control @error('libelle') is-invalid @enderror"
                   required>
            @error('libelle')<div class="invalid-feedback">{{ $message }}</div>@enderror
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary">Créer le compte</button>
        </div>
      </form>
    </div>
  </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  // 1) Masquer l'alerte de succès création de compte au bout de 2s
  const acctAlert = document.getElementById('account-success-alert');
  if (acctAlert) {
	  setTimeout(() => {
		acctAlert.style.opacity = '0';
		acctAlert.style.visibility = 'hidden';
	  }, 2000);
	}

  // 2) Rouvrir le modal de création si validation KO
  @if($errors->has('numero') || $errors->has('libelle'))
    new bootstrap.Modal(document.getElementById('createCompteModal')).show();
  @endif

  // … (votre JS existant pour les lignes et l’historique) …
});
</script>
<script>
document.addEventListener('DOMContentLoaded', () => {
  // Masquer l'alerte succès après 2 secondes sans décalage
  const alert = document.getElementById('success-alert');
  if (alert) {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.visibility = 'hidden';
      // min-height et transition gèrent l'espace sans sauts
    }, 2000);
  }

  // Gestion du popup d’édition pour l'historique
  const actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
  const iframe      = document.getElementById('modal-iframe');
  document.querySelectorAll('.écriture-item').forEach(item => {
    item.addEventListener('click', () => {
      iframe.src = item.dataset.editUrl;
      actionModal.show();
    });
  });

  // Préparation données JS pour lignes
  window.journalCP = @json($journaux->pluck('contrepartie','code')->all());
  window.comptes   = @json($comptes->map(fn($c)=>['numero'=>$c->numero,'libelle'=>$c->libelle]));

  const container  = document.getElementById('lignes-container');
  const journalSel = document.getElementById('journal');
  let index        = container.children.length;

  // 1) Formatage des montants
  function formatMontant(el) {
    const rawValue  = el.value;
    const rawCursor = el.selectionStart;
    const normalized= rawValue.replace(/\./g, ',');
    const left      = normalized.slice(0, rawCursor);
    const sigCount  = (left.match(/[\d,]/g)||[]).length;
    let tmp = normalized.replace(/[^\d,,-]/g, '').replace(/,/g, '.');
    const neg = tmp.startsWith('-') ? '-' : '';
    tmp = tmp.replace(/^-/, '');
    let [intPart, decPart] = tmp.split('.');
    decPart = (decPart||'').slice(0,2);
    intPart = intPart.replace(/^0+/, '') || '0';
    const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    const justSep = normalized[rawCursor -1]===',';
    let formatted;
    if (justSep) {
      formatted = `${neg}${spaced}, €`;
    } else if (decPart.length>0) {
      formatted = `${neg}${spaced},${decPart} €`;
    } else {
      formatted = `${neg}${spaced} €`;
    }
    el.value = formatted;
    let count=0, pos=formatted.length-2;
    for (let i=0; i<formatted.length; i++){
      if (/[\d,]/.test(formatted[i])) count++;
      if (count>=sigCount){ pos=i+1; break; }
    }
    pos = Math.min(Math.max(pos,0), formatted.length-2);
    el.setSelectionRange(pos,pos);
  }

  // 2) Applique la contrepartie
  function applyCP() {
    const cp = journalCP[journalSel.value]||null;
    const rows = Array.from(container.children);
    if (!rows.length) return;
    const last = rows[rows.length-1];
    const sel  = last.querySelector('.compte-select');
    const mnt  = last.querySelector('.montant-input');
    const btn  = last.querySelector('.remove-ligne');

    if (cp) {
      sel.value = cp; sel.style.pointerEvents='none'; sel.classList.add('bg-light'); btn.style.visibility='hidden';
      let sum=0;
      rows.slice(0,-1).forEach(r=>{
        let v=r.querySelector('.montant-input').value.replace(/\s/g,'').replace('€','').replace(',','.');
        sum+=parseFloat(v)||0;
      });
      const raw = (-sum).toFixed(2).split('.');
      const i   = (raw[0].replace(/^0+/,'')||'0').replace(/\B(?=(\d{3})+(?!\d))/g,' ');
      const inv = raw[1]==='00'?`${i} €`:`${i},${raw[1]} €`;
      mnt.value=inv; mnt.readOnly=true; mnt.classList.add('bg-light');
    } else {
      sel.style.pointerEvents=''; sel.classList.remove('bg-light');
      mnt.readOnly=false; mnt.classList.remove('bg-light'); btn.style.visibility='visible';
    }
  }

  // 3) Gestion du DOM pour les lignes
  container.addEventListener('input', e => {
    if (e.target.matches('.montant-input')) {
      formatMontant(e.target);
      applyCP();
    }
  });
  journalSel.addEventListener('change', applyCP);
  document.getElementById('add-ligne').addEventListener('click', () => {
    container.insertAdjacentHTML('afterbegin', ligneHTML(index++));
    applyCP();
  });
  container.addEventListener('click', e => {
    if (e.target.matches('.remove-ligne')) {
      e.target.closest('.ligne-row').remove();
      applyCP();
    }
  });

  function ligneHTML(i) {
    let opts = '<option value="">Compte…</option>';
    window.comptes.forEach(c => {
      opts += `<option value="${c.numero}">${c.numero} – ${c.libelle}</option>`;
    });
    return `
      <div class="row mb-3 align-items-center ligne-row" data-index="${i}">
        <div class="col-md-4">
          <select name="lignes[${i}][compte]" class="form-select compte-select" required>
            ${opts}
          </select>
        </div>
        <div class="col-md-2">
          <input type="text"
                 name="lignes[${i}][montant]"
                 class="form-control montant-input"
                 placeholder="Montant"
                 required>
        </div>
        <div class="col-md-5">
          <input type="text"
                 name="lignes[${i}][commentaire]"
                 class="form-control"
                 placeholder="Commentaire">
        </div>
        <div class="col-md-1 text-end">
          <button type="button" class="btn btn-danger remove-ligne">×</button>
        </div>
      </div>`;
  }

  // 4) PRÉ-SÉLECTION DYNAMIQUE DU COMPTE PAR DÉFAUT
  function debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  const labelInput = document.getElementById('label');
  const firstCompteSelect = () =>
    document.querySelector('.ligne-row[data-index="0"] .compte-select');

  const fetchDefault = debounce(async () => {
    const label = labelInput.value.trim();
    if (!label) return;

    const url = new URL("{{ route('ecritures.default_compte') }}", location.origin);
    url.searchParams.set('label', label);

    try {
      const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) throw new Error('Network response was not OK');
      const { compte } = await res.json();
      const sel = firstCompteSelect();
      if (!sel) return;

      sel.value = compte || '';
    } catch (err) {
      console.error('[ERROR] fetchDefault:', err);
    }
  }, 400);

  labelInput.addEventListener('input', fetchDefault);
  labelInput.addEventListener('keyup', fetchDefault);

  if (labelInput.value.trim()) {
    fetchDefault();
  }

  // Initialisation
  applyCP();
});
</script>
@endpush
