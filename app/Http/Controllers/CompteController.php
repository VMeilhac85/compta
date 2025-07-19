<?php

namespace App\Http\Controllers;

use App\Models\Compte;
use Illuminate\Http\Request;
use App\Models\Ligne; 
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use App\Events\DatabaseUpdated;

class CompteController extends Controller
{
    /**
     * Affiche le plan comptable (liste de tous les comptes).
     */
    public function index()
    {
        $comptes = Compte::orderBy('numero')->get();
        return view('parametres.plan-comptable', compact('comptes'));
    }

    /**
     * Enregistre un nouveau compte.
     * Conserve les redirections contextuelles vers balance / grand-livre,
     * ou revient sur le plan comptable.
     * En cas d’erreur, renvoie avec 'showCreateModal' pour rouvrir le popup.
     */
    public function store(Request $request)
    {
        $rules = [
            'numero'  => ['required', 'digits:6', 'unique:comptes,numero'],
            'libelle' => ['required', 'string', 'max:255'],
        ];
        $messages = [
            'numero.digits' => 'Le numéro doit comporter exactement 6 chiffres.',
            'numero.unique' => 'Ce numéro existe déjà.',
        ];

        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            return redirect()->back()
                             ->withErrors($validator)
                             ->withInput()
                             ->with('showCreateModal', true);
        }

        $validated = $validator->validated();
        $compte = Compte::create($validated);

        // Contexte Balance (popup transfert)
        if ($request->has('preserve_period1_start')) {
			event(new DatabaseUpdated());
            return redirect()->route('consult.balance', [
                    'period1_start'  => $request->input('preserve_period1_start'),
                    'period1_end'    => $request->input('preserve_period1_end'),
                    'enable_compare' => $request->input('preserve_enable_compare'),
                    'period2_start'  => $request->input('preserve_period2_start'),
                    'period2_end'    => $request->input('preserve_period2_end'),
                    'hide_zero'      => $request->input('preserve_hide_zero'),
                ])
                ->with('new_compte', $compte->numero)
                ->with('preserve_account_ids', $request->input('preserve_account_ids'));
        }

        // Contexte Grand-Livre (popup transfert)
        if ($request->has('preserve_account')) {
			event(new DatabaseUpdated());
            return redirect()->route('consult.grand_livre', [
                    'account'      => $request->input('preserve_account'),
                    'period_start' => $request->input('preserve_period_start'),
                    'period_end'   => $request->input('preserve_period_end'),
                ])
                ->with('new_compte', $compte->numero)
                ->with('preserve_line_ids', $request->input('preserve_line_ids'));
        }
		
		if ($request->filled('preserve_url')) {
			event(new DatabaseUpdated());
			return redirect($request->input('preserve_url'))
           ->with('accountSuccess', 'Compte créé avec succès !');
		}

        // Création depuis Plan comptable : retour au listing
		event(new DatabaseUpdated());
        return redirect()
            ->route('parametres.plan_comptable')
            ->with('success', 'Compte créé avec succès !');
    }

    /**
     * Met à jour un compte existant.
     */
    public function update(Request $request, Compte $compte)
    {
        $rules = [
            'numero'  => [
                'required',
                'digits:6',
                Rule::unique('comptes','numero')->ignore($compte->numero, 'numero'),
            ],
            'libelle' => ['required','string','max:255'],
        ];
        $messages = [
            'numero.digits' => 'Le numéro doit comporter exactement 6 chiffres.',
            'numero.unique' => 'Ce numéro existe déjà.',
        ];

        $validator = Validator::make($request->all(), $rules, $messages);

        if ($validator->fails()) {
            // On pourrait gérer un flag showEditModal si besoin
            return redirect()->back()
                             ->withErrors($validator)
                             ->withInput();
        }

        $compte->update($validator->validated());
		event(new DatabaseUpdated());
        return redirect()
            ->route('parametres.plan_comptable')
            ->with('success', 'Compte mis à jour avec succès !');
    }

    /**
     * Supprime un compte existant.
     */
    public function destroy(Request $request, Compte $compte)
	{
		// Si des écritures existent pour ce compte
		if (Ligne::where('compte', $compte->numero)->exists()) {
			// On passe toutes les données nécessaires au modal dans la session
			return redirect()
				->route('parametres.plan_comptable')
				->with('showEditModal', true)
				->with('deleteError', 'Impossible de supprimer ce compte car il contient des écritures.')
				->with('editModalData', [
					'id'           => $compte->id,
					'numero'       => $compte->numero,
					'libelle'      => $compte->libelle,
					'routeUpdate'  => route('parametres.plan_comptable.update', $compte),
					'routeDelete'  => route('parametres.plan_comptable.destroy', $compte),
				]);
		}

		$compte->delete();
		event(new DatabaseUpdated());
		return redirect()
			->route('parametres.plan_comptable')
			->with('success', 'Compte supprimé avec succès !');
	}
}
