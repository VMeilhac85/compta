<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Http\Requests\StoreEcritureRequest;
use App\Models\Ecriture;
use App\Models\Ligne;
use App\Models\Journal;
use App\Models\Compte;
use App\Events\DatabaseUpdated;

class EcritureController extends Controller
{
    /**
     * Affiche le formulaire de création.
     */
    public function create(Request $request)
    {
        $journaux       = Journal::all();
        $comptes        = Compte::all();

        $dernierJournal = Ecriture::latest('created_at')->value('journal');
        $contrepartie   = Journal::where('code', $dernierJournal)
                                 ->value('contrepartie');

        $dernierLabel   = Ecriture::latest('created_at')->value('label');
        $ancienCompte   = Ligne::join('ecritures', 'ecritures.id', '=', 'lignes.ecriture')
                                ->where('ecritures.label', $dernierLabel)
                                ->latest('lignes.created_at')
                                ->value('lignes.compte');

        $user           = Auth::user();
        $limit          = (int) $request->query('limit', $user->nb_dernieres_ec);
        $historique     = Ecriture::where('user_creation', $user->id)
                                  ->latest('created_at')
                                  ->limit($limit)
                                  ->get();
        return view('ecritures.create', compact(
            'journaux',
            'comptes',
            'dernierJournal',
            'contrepartie',
            'ancienCompte',
            'limit',
            'historique'
        ));
    }

    /**
     * Enregistre une nouvelle écriture et ses lignes.
     */
    public function store(StoreEcritureRequest $request)
    {
        $data = $request->validated();

        DB::transaction(function() use ($data) {
            $ecriture = Ecriture::create([
                'journal'           => $data['journal'],
                'date'              => $data['date'],
                'label'             => $data['label'],
                'lignes'            => '',
                'user_creation'     => Auth::id(),
                'user_modification' => Auth::id(),
            ]);

            $ids = [];
            foreach ($data['lignes'] as $ligneData) {
                $raw = str_replace([' ', '€'], '', $ligneData['montant']);
                $raw = str_replace(',', '.', $raw);
                $montant = (float) $raw;

                $ligne = $ecriture->lignes()->create([
                    'compte'      => $ligneData['compte'],
                    'montant'     => $montant,
                    'commentaire' => $ligneData['commentaire'] ?? '',
                ]);

                $ids[] = $ligne->id;
            }

            $ecriture->update([
                'lignes' => implode(';', $ids),
            ]);
        });
		event(new DatabaseUpdated());
        return redirect()
            ->route('ecritures.create')
            ->with('success', 'Écriture créée avec succès !');
    }

    /**
     * Affiche le formulaire d’édition pour une écriture existante.
     */
    public function edit(Ecriture $ecriture)
    {
        $journaux = Journal::all();
        $comptes  = Compte::all();

        $ligneIds = array_filter(
            explode(';', $ecriture->lignes),
            fn($i) => is_numeric($i)
        );
        $lignes = Ligne::whereIn('id', $ligneIds)->get();
        return view('ecritures.edit', compact(
            'ecriture',
            'journaux',
            'comptes',
            'lignes'
        ));
    }

    /**
     * Met à jour l’écriture et ses lignes.
     */
    public function update(StoreEcritureRequest $request, Ecriture $ecriture)
    {
        $data = $request->validated();

        DB::transaction(function() use ($data, $ecriture) {
            $ecriture->update([
                'journal'           => $data['journal'],
                'date'              => $data['date'],
                'label'             => $data['label'],
                'user_modification' => Auth::id(),
            ]);

            $oldIds = array_filter(
                explode(';', $ecriture->lignes),
                fn($i) => is_numeric($i)
            );
            Ligne::whereIn('id', $oldIds)->delete();

            $ids = [];
            foreach ($data['lignes'] as $ligneData) {
                $raw = str_replace([' ', '€'], '', $ligneData['montant']);
                $raw = str_replace(',', '.', $raw);
                $montant = (float) $raw;

                $ligne = $ecriture->lignes()->create([
                    'compte'      => $ligneData['compte'],
                    'montant'     => $montant,
                    'commentaire' => $ligneData['commentaire'] ?? '',
                ]);

                $ids[] = $ligne->id;
            }

            $ecriture->update([
                'lignes' => implode(';', $ids),
            ]);
        });
		event(new DatabaseUpdated());
        return redirect()
            ->route('ecritures.create')
            ->with('success', 'Écriture mise à jour avec succès !');
    }

    /**
     * Supprime une écriture ET ses lignes associées.
     */
    public function destroy(Ecriture $ecriture)
    {
        $ids = array_filter(
            explode(';', $ecriture->lignes),
            fn($i) => is_numeric($i)
        );

        Ligne::whereIn('id', $ids)->delete();
        $ecriture->delete();
		event(new DatabaseUpdated());
        return redirect()
            ->route('ecritures.create')
            ->with('success', 'Écriture et lignes associées supprimées avec succès.');
    }

    /**
     * Retourne le numéro de compte « par défaut »
     * basé sur la dernière écriture du même label,
     * en excluant les comptes commençant par 512.
     */
    public function defaultCompte(Request $request): JsonResponse
    {
        $label = $request->query('label');
        if (! $label) {
            return response()->json(['compte' => null]);
        }

        $ecriture = Ecriture::where('label', $label)
                            ->latest('created_at')
                            ->first();

        if (! $ecriture) {
            return response()->json(['compte' => null]);
        }

        $ids     = array_filter(explode(';', $ecriture->lignes), 'is_numeric');
        $comptes = Ligne::whereIn('id', $ids)
                        ->orderBy('created_at')
                        ->pluck('compte')
                        ->toArray();

        // Exclure les comptes 512…
        $hors512 = array_filter($comptes, fn($c) => ! str_starts_with((string)$c, '512'));

        $num = ! empty($hors512)
             ? end($hors512)
             : (end($comptes) ?: null);

        return response()->json(['compte' => $num]);
    }
	
	public function journalBulkDelete(Request $request)
	{
		$lineIds = array_filter(explode(',', $request->input('line_ids', '')));
		$ecritureIds = Ligne::whereIn('id', $lineIds)
							->pluck('ecriture')
							->unique()
							->toArray();

		DB::transaction(function() use ($ecritureIds) {
			Ligne::whereIn('ecriture', $ecritureIds)->delete();
			Ecriture::whereIn('id', $ecritureIds)->delete();
		});
		event(new DatabaseUpdated());
		return redirect()
			->route('ecritures.journal', [
				'journal' => $request->input('journal'),
				'start'   => $request->input('start'),
				'end'     => $request->input('end'),
			])
			->with('success', count($ecritureIds).' écriture(s) supprimée(s).');
	}

	/**
	 * Duplication en masse depuis le Journal :
	 * duplique les écritures sélectionnées à une date donnée.
	 */
	public function journalBulkDuplicate(Request $request)
	{
		$lineIds     = array_filter(explode(',', $request->input('line_ids', '')));
		$ecritureIds = Ligne::whereIn('id', $lineIds)
							->pluck('ecriture')
							->unique()
							->toArray();

		$dateIso = $request->input('duplicate_date');

		$new = Ecriture::whereIn('id', $ecritureIds)
			->get()
			->map(function(Ecriture $e) use ($dateIso) {
				$copy = $e->replicate();
				$copy->date = Carbon::createFromFormat('Y-m-d', $dateIso)
									   ->format('d/m/Y');
				$copy->save();

				foreach ($e->lignes()->get() as $ligne) {
					$clone = $ligne->replicate();
					$clone->ecriture = $copy->id;
					$clone->save();
				}
				event(new DatabaseUpdated());
				return $copy;
			});
		event(new DatabaseUpdated());
		return redirect()
			->route('ecritures.journal', [
				'journal' => $request->input('journal'),
				'start'   => $request->input('start'),
				'end'     => $request->input('end'),
			])
			->with('success', count($new).' écriture(s) dupliquée(s).');
	}

	/**
	 * Export PDF/Excel en masse depuis le Journal :
	 * exporte les lignes sélectionnées.
	 */
	public function journalBulkExport(Request $request)
	{
		$lineIds = array_filter(explode(',', $request->input('line_ids', '')));
		$format  = $request->input('export_format', 'excel');
		$journal = $request->input('journal');
		$start   = $request->input('start');
		$end     = $request->input('end');

		$lines = DB::table('lignes')
			->join('ecritures','lignes.ecriture','=','ecritures.id')
			->whereIn('lignes.id', $lineIds)
			->where('ecritures.journal', $journal)
			->whereRaw(
				"STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') BETWEEN ? AND ?",
				[$start, $end]
			)
			->select(
				DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
				'lignes.ecriture as num_ecriture',
				'lignes.compte',
				'ecritures.label as libelle',
				'lignes.commentaire',
				'lignes.montant'
			)
			->orderBy('num_ecriture', 'desc')
			->get();

		$exportData = [];
		$cum = 0;
		foreach ($lines as $ln) {
			$cum += $ln->montant;
			$exportData[] = [
				'Num. Écr.'   => $ln->num_ecriture,
				'Date'        => Carbon::parse($ln->date_iso)->format('d/m/Y'),
				'Compte'      => $ln->compte,
				'Libellé'     => $ln->libelle,
				'Commentaire' => $ln->commentaire,
				'Montant'     => number_format($ln->montant,2,',',''),
				'Cumul'       => number_format($cum,2,',',''),
			];
		}

		if ($format === 'pdf') {
			$pdf = Pdf::loadView('consult.export-journal-pdf', [
				'lignes'  => $exportData,
				'journal' => $journal,
				'start'   => $start,
				'end'     => $end,
			])->setPaper('a4', 'landscape');
			event(new DatabaseUpdated());
			return $pdf->download("journal-{$journal}_{$start}_{$end}.pdf");
		}
		event(new DatabaseUpdated());
		return Excel::download(new LignesExport($exportData), "journal-{$journal}_{$start}_{$end}.xlsx");
	}
}
