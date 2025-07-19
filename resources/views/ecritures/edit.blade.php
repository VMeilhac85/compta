@extends('layouts.app')

@section('content')
{{-- On masque la navbar (édition dans l’iframe) et on supprime tout espace bas du container --}}
<style>
  nav.navbar { display: none !important; }
  .container { margin-bottom: 0; padding-bottom: 0; }
</style>

<div class="container mt-4">
  {{-- Formulaire de modification --}}
  <form id="ecriture-edit-form"
        action="{{ route('ecritures.update', $ecriture) }}"
        method="POST">
    @csrf
    @method('PUT')

    {{-- Informations de l’écriture --}}
    <div class="row mb-3 align-items-center">
      <div class="col-md-4">
        <select name="journal" id="journal"
                class="form-select @error('journal') is-invalid @enderror"
                required>
          <option value="">-- Journal --</option>
          @foreach($journaux as $j)
            <option value="{{ $j->code }}"
              {{ old('journal', $ecriture->journal) === $j->code ? 'selected' : '' }}>
              {{ $j->code }} – {{ $j->name }}
            </option>
          @endforeach
        </select>
        @error('journal')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
      <div class="col-md-2">
        <input type="text" name="date" id="date"
               class="form-control @error('date') is-invalid @enderror"
               value="{{ old('date', $ecriture->date) }}"
               required>
        @error('date')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
      <div class="col-md-6">
        <input type="text" name="label" id="label"
               class="form-control @error('label') is-invalid @enderror"
               placeholder="Libellé"
               value="{{ old('label', $ecriture->label) }}"
               required>
        @error('label')<div class="invalid-feedback">{{ $message }}</div>@enderror
      </div>
    </div>

    {{-- Lignes --}}
    <div id="lignes-container">
      @php
        $old      = old('lignes', []);
        $initial  = count($old)
                    ? $old
                    : $lignes->map(function($L) {
                        return [
                          'compte'      => $L->compte,
                          'montant'     => number_format($L->montant, 2, ',', ' ') . ' €',
                          'commentaire' => $L->commentaire,
                        ];
                      })->toArray();
        $count    = max(2, count($initial));
      @endphp

      @for($i = 0; $i < $count; $i++)
        @php $val = $initial[$i] ?? []; @endphp
        <div class="row mb-3 align-items-center ligne-row" data-index="{{ $i }}">
          <div class="col-md-4">
            <select name="lignes[{{ $i }}][compte]"
                    class="form-select compte-select @error('lignes.'.$i.'.compte') is-invalid @enderror"
                    required>
              <option value="">Compte…</option>
              @foreach($comptes as $c)
                <option value="{{ $c->numero }}"
                  {{ (string)$c->numero === (string)($val['compte'] ?? '') ? 'selected' : '' }}>
                  {{ $c->numero }} – {{ $c->libelle }}
                </option>
              @endforeach
            </select>
            @error('lignes.'.$i.'.compte')<div class="invalid-feedback">{{ $message }}</div>@enderror
          </div>
          <div class="col-md-2">
            <input type="text"
                   name="lignes[{{ $i }}][montant]"
                   class="form-control montant-input @error('lignes.'.$i.'.montant') is-invalid @enderror"
                   placeholder="Montant"
                   value="{{ $val['montant'] ?? '' }}"
                   required>
            @error('lignes.'.$i.'.montant')<div class="invalid-feedback">{{ $message }}</div>@enderror
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
      <button type="submit" class="btn btn-success">
        Modifier l’écriture
      </button>
    </div>
  </form>

  {{-- Formulaire de suppression --}}
  <div class="mt-2">
    <form id="delete-form"
          action="{{ route('ecritures.destroy', $ecriture) }}"
          method="POST">
      @csrf
      @method('DELETE')
      <button type="submit" class="btn btn-danger">
        Supprimer l’écriture
      </button>
    </form>
  </div>
</div>
@endsection

@push('scripts')
<script>
document.addEventListener('DOMContentLoaded', () => {
  const container  = document.getElementById('lignes-container');
  const journalSel = document.getElementById('journal');
  let index        = container.children.length;

  // Formatage dynamique des montants (espaces, virgule, €)
  function formatMontant(el) {
    const rawValue  = el.value;
    const rawCursor = el.selectionStart;
    const normalized= rawValue.replace(/\./g, ',');
    const left      = normalized.slice(0, rawCursor);
    const sigCount  = (left.match(/[\d,]/g) || []).length;
    let tmp = normalized.replace(/[^\d,,-]/g, '').replace(/,/g, '.');
    const neg = tmp.startsWith('-') ? '-' : '';
    tmp = tmp.replace(/^-/, '');
    let [intPart, decPart] = tmp.split('.');
    decPart = (decPart||'').slice(0,2);
    intPart = intPart.replace(/^0+/, '') || '0';
    const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const justSep = normalized[rawCursor - 1] === ',';
    let formatted;
    if (justSep) {
      formatted = `${neg}${spaced}, €`;
    } else if (decPart.length > 0) {
      formatted = `${neg}${spaced},${decPart} €`;
    } else {
      formatted = `${neg}${spaced} €`;
    }
    el.value = formatted;
    let count = 0, pos = formatted.length - 2;
    for (let i = 0; i < formatted.length; i++) {
      if (/[\d,]/.test(formatted[i])) count++;
      if (count >= sigCount) { pos = i + 1; break; }
    }
    pos = Math.min(Math.max(pos, 0), formatted.length - 2);
    el.setSelectionRange(pos, pos);
  }

  // Applique la contrepartie quand il y en a une
  function applyCP() {
    const cpMap = @json($journaux->pluck('contrepartie','code')->all());
    const cp    = cpMap[journalSel.value] || null;
    const rows  = Array.from(container.children);
    if (!rows.length) return;
    const last = rows[rows.length - 1];
    const sel  = last.querySelector('.compte-select');
    const mnt  = last.querySelector('.montant-input');
    const btn  = last.querySelector('.remove-ligne');

    if (cp) {
      sel.value = cp;
      sel.style.pointerEvents = 'none';
      sel.classList.add('bg-light');
      btn.style.visibility = 'hidden';

      let sum = 0;
      rows.slice(0, -1).forEach(r => {
        let v = r.querySelector('.montant-input').value
                     .replace(/\s/g,'')
                     .replace('€','')
                     .replace(',','.');
        sum += parseFloat(v) || 0;
      });
      let rawInv = (-sum).toFixed(2);
      let [i, d]  = rawInv.split('.');
      i = i.replace(/^0+/, '') || '0';
      const sInt = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const inv  = (d === '00') ? `${sInt} €` : `${sInt},${d} €`;

      mnt.value    = inv;
      mnt.readOnly = true;
      mnt.classList.add('bg-light');
    } else {
      sel.style.pointerEvents = '';
      sel.classList.remove('bg-light');
      mnt.readOnly = false;
      mnt.classList.remove('bg-light');
      btn.style.visibility = 'visible';
    }
  }

  // Gestions des événements
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

  // Génère le HTML d'une nouvelle ligne
  function ligneHTML(i) {
    let opts = '<option value="">Compte…</option>';
    @foreach($comptes as $c)
      opts += `<option value="{{ $c->numero }}">{{ $c->numero }} – {{ $c->libelle }}</option>`;
    @endforeach
    return `
      <div class="row mb-3 align-items-center ligne-row" data-index="${i}">
        <div class="col-md-4">
          <select name="lignes[${i}][compte]" class="form-select compte-select" required>${opts}</select>
        </div>
        <div class="col-md-2">
          <input type="text" name="lignes[${i}][montant]" class="form-control montant-input" placeholder="Montant" required>
        </div>
        <div class="col-md-5">
          <input type="text" name="lignes[${i}][commentaire]" class="form-control" placeholder="Commentaire">
        </div>
        <div class="col-md-1 text-end">
          <button type="button" class="btn btn-danger remove-ligne">×</button>
        </div>
      </div>`;
  }

  // Soumission AJAX du formulaire d’édition
  document.getElementById('ecriture-edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const res  = await fetch(form.action, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: data
    });
    if (res.ok) {
      // Ferme le modal et recharge la page parent
      const modalEl = window.parent.document.getElementById('actionModal');
      window.parent.bootstrap.Modal.getInstance(modalEl).hide();
      window.parent.location.reload();
    } else {
      const html = await res.text();
      document.open(); document.write(html); document.close();
    }
  });

  // Soumission AJAX du formulaire de suppression
  document.getElementById('delete-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!confirm('Supprimer cette écriture ?')) return;
    const form = e.target;
    const data = new FormData(form);
    const res  = await fetch(form.action, {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: data
    });
    if (res.ok) {
      const modalEl = window.parent.document.getElementById('actionModal');
      window.parent.bootstrap.Modal.getInstance(modalEl).hide();
      window.parent.location.reload();
    } else {
      const html = await res.text();
      document.open(); document.write(html); document.close();
    }
  });

  // Initialisation
  applyCP();
});
</script>
@endpush
