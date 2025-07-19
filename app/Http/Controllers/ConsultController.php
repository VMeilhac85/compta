<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Compte;
use App\Models\Ecriture;
use App\Models\Ligne;
use Barryvdh\DomPDF\Facade\Pdf;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\LignesExport;
use App\Exports\BalanceExport;
use Carbon\Carbon;
use App\Events\DatabaseUpdated;

class ConsultController extends Controller
{
    /**
     * Affiche la balance.
     */
    public function balance(Request $request)
    {
        // 1) date la plus ancienne et la plus récente en base
        $minDateRaw = DB::table('ecritures')
            ->selectRaw("MIN(STR_TO_DATE(`date`, '%d/%m/%Y')) as min_date")
            ->value('min_date');
        $maxDateRaw = DB::table('ecritures')
            ->selectRaw("MAX(STR_TO_DATE(`date`, '%d/%m/%Y')) as max_date")
            ->value('max_date');

        $earliestDate = $minDateRaw
            ? date('Y-m-d', strtotime($minDateRaw))
            : date('Y-m-d');
        $latestDate   = $maxDateRaw
            ? date('Y-m-d', strtotime($maxDateRaw))
            : date('Y-m-d');

        // 2) filtres GET
        $period1Start  = $request->query('period1_start',  $earliestDate);
        $period1End    = $request->query('period1_end',    $latestDate);
        $enableCompare = $request->boolean('enable_compare');
        $period2Start  = $enableCompare
                         ? $request->query('period2_start', $earliestDate)
                         : null;
        $period2End    = $enableCompare
                         ? $request->query('period2_end',   $latestDate)
                         : null;
        $hideZero      = $request->boolean('hide_zero');

        // 3) solde1
        $solde1 = DB::table('lignes')
            ->join('ecritures','lignes.ecriture','=','ecritures.id')
            ->select('lignes.compte as compte', DB::raw('SUM(lignes.montant) as total1'))
            ->whereRaw(
              "STR_TO_DATE(ecritures.`date`,'%d/%m/%Y') BETWEEN ? AND ?",
              [$period1Start, $period1End]
            )
            ->groupBy('lignes.compte')
            ->pluck('total1','compte')
            ->toArray();

        // 4) solde2
        $solde2 = [];
        if ($enableCompare && $period2Start && $period2End) {
            $solde2 = DB::table('lignes')
                ->join('ecritures','lignes.ecriture','=','ecritures.id')
                ->select('lignes.compte as compte', DB::raw('SUM(lignes.montant) as total2'))
                ->whereRaw(
                  "STR_TO_DATE(ecritures.`date`,'%d/%m/%Y') BETWEEN ? AND ?",
                  [$period2Start, $period2End]
                )
                ->groupBy('lignes.compte')
                ->pluck('total2','compte')
                ->toArray();
        }

        // 5) construction data
        $data = [];
        foreach (Compte::orderBy('numero')->get() as $c) {
            $num = $c->numero;
            $row = [
                'compte'  => $num,
                'libelle' => $c->libelle,
                'solde1'  => $solde1[$num] ?? 0.0,
            ];
            if ($enableCompare) {
                $s2 = $solde2[$num] ?? 0.0;
                $row['solde2']    = $s2;
                $row['variation'] = $s2 - $row['solde1'];
            }
            $data[] = $row;
        }

        // 6) masquage soldes nuls
        if ($hideZero) {
            $data = array_values(array_filter($data, function($r) {
                $z1 = abs($r['solde1']) < 0.001;
                $z2 = (!isset($r['solde2']) || abs($r['solde2']) < 0.001);
                return !($z1 && $z2);
            }));
        }
        return view('consult.balance', compact(
            'data',
            'earliestDate',
            'latestDate',
            'period1Start',
            'period1End',
            'enableCompare',
            'period2Start',
            'period2End',
            'hideZero'
        ));
    }

        /**
     * Transfert en masse depuis la balance.
     * Ne prend en compte que les lignes dont la date d'écriture est dans la période.
     */
    public function balanceBulkTransfer(Request $request)
    {
        $accountNumbers = array_filter(explode(',', $request->input('account_ids', '')));
        $newAccount     = $request->input('transfer_account');

        // Récupérer les IDs de lignes filtrées par compte ET par date d'écriture
        $period1Start = $request->input('period1_start');
        $period1End   = $request->input('period1_end');

        $lineIds = DB::table('lignes')
            ->join('ecritures', 'lignes.ecriture', '=', 'ecritures.id')
            ->whereIn('lignes.compte', $accountNumbers)
            ->whereRaw(
                "STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') BETWEEN ? AND ?",
                [$period1Start, $period1End]
            )
            ->pluck('lignes.id')
            ->toArray();

        // Transfert
        Ligne::whereIn('id', $lineIds)
             ->update(['compte' => $newAccount]);
		event(new DatabaseUpdated());
        return redirect()
            ->route('consult.balance', [
                'period1_start'   => $period1Start,
                'period1_end'     => $period1End,
                'enable_compare'  => $request->input('enable_compare'),
                'period2_start'   => $request->input('period2_start'),
                'period2_end'     => $request->input('period2_end'),
                'hide_zero'       => $request->input('hide_zero'),
            ])
            ->with('success', count($lineIds).' ligne(s) transférée(s).')
            ->with('preserve_account_ids', $request->input('account_ids'));
    }


    /**
     * Export de la balance (Excel ou PDF).
     */
    public function balanceBulkExport(Request $request)
    {
        $accountNumbers = array_filter(explode(',', $request->input('account_ids', '')));
        $period1Start   = $request->input('period1_start');
        $period1End     = $request->input('period1_end');
        $enableCompare  = $request->boolean('enable_compare');
        $period2Start   = $enableCompare ? $request->input('period2_start') : null;
        $period2End     = $enableCompare ? $request->input('period2_end')   : null;

        // solde1
        $solde1 = DB::table('lignes')
            ->join('ecritures','lignes.ecriture','=','ecritures.id')
            ->select('lignes.compte as compte', DB::raw('SUM(lignes.montant) as total1'))
            ->whereIn('lignes.compte', $accountNumbers)
            ->whereRaw(
                "STR_TO_DATE(ecritures.`date`,'%d/%m/%Y') BETWEEN ? AND ?",
                [$period1Start, $period1End]
            )
            ->groupBy('lignes.compte')
            ->pluck('total1','compte')
            ->toArray();

        // solde2 si comparaison
        $solde2 = [];
        if ($enableCompare && $period2Start && $period2End) {
            $solde2 = DB::table('lignes')
                ->join('ecritures','lignes.ecriture','=','ecritures.id')
                ->select('lignes.compte as compte', DB::raw('SUM(lignes.montant) as total2'))
                ->whereIn('lignes.compte', $accountNumbers)
                ->whereRaw(
                    "STR_TO_DATE(ecritures.`date`,'%d/%m/%Y') BETWEEN ? AND ?",
                    [$period2Start, $period2End]
                )
                ->groupBy('lignes.compte')
                ->pluck('total2','compte')
                ->toArray();
        }

        // construction données export
        $exportData = [];
        foreach (Compte::whereIn('numero', $accountNumbers)->get() as $c) {
            $num = $c->numero;
            $row = [
                'compte'  => $num,
                'libelle' => $c->libelle,
                'solde1'  => $solde1[$num] ?? 0.0,
            ];
            if ($enableCompare) {
                $row['solde2']    = $solde2[$num] ?? 0.0;
                $row['variation'] = $row['solde2'] - $row['solde1'];
            }
            $exportData[] = $row;
        }

        $format = $request->input('export_format', 'excel');
        if ($format === 'pdf') {
            $pdf = Pdf::loadView('consult.export-balance-pdf', [
                'lignes'        => $exportData,
                'period1Start'  => $period1Start,
                'period1End'    => $period1End,
                'enableCompare' => $enableCompare,
                'period2Start'  => $period2Start,
                'period2End'    => $period2End,
            ])->setPaper('a4', 'portrait');
			
            return $pdf->download("balance-{$period1Start}_{$period1End}.pdf");
        }

        return Excel::download(new BalanceExport($exportData), "balance-{$period1Start}_{$period1End}.xlsx");
    }

    /**
     * Affiche le grand-livre avec restauration de contexte.
     */
    public function grandLivre(Request $request)
    {
        // 1) bornes globales
        $minRaw = DB::table('ecritures')
            ->selectRaw("MIN(STR_TO_DATE(`date`, '%d/%m/%Y')) as min_date")
            ->value('min_date');
        $maxRaw = DB::table('ecritures')
            ->selectRaw("MAX(STR_TO_DATE(`date`, '%d/%m/%Y')) as max_date")
            ->value('max_date');

        $earliest = $minRaw
            ? date('Y-m-d', strtotime($minRaw))
            : date('Y-m-d');
        $latest = $maxRaw
            ? date('Y-m-d', strtotime($maxRaw))
            : date('Y-m-d');

        // 2) comptes
        $comptes = Compte::orderBy('numero')->get();

        // 3) contexte session
        $preserveAccount = session('preserve_account');
        $preserveStart   = session('preserve_period_start');
        $preserveEnd     = session('preserve_period_end');
        $preserveLineIds = session('preserve_line_ids');
        $newCompte       = session('new_compte');

        // 4) compte courant
        $account = $preserveAccount
                 ? $preserveAccount
                 : $request->query('account', optional($comptes->first())->numero);

        // 5) voisins
        $idx  = $comptes->search(fn($c) => $c->numero == $account);
        $prev = $idx > 0 ? $comptes[$idx - 1] : null;
        $next = $idx !== false && $idx < $comptes->count() - 1
              ? $comptes[$idx + 1] : null;

        // 6) période
        $start = $preserveStart
               ? $preserveStart
               : $request->query('period_start', $earliest);
        $end   = $preserveEnd
               ? $preserveEnd
               : $request->query('period_end',   $latest);

        // 7) extraction des lignes
        $lignes = DB::table('lignes')
            ->join('ecritures','lignes.ecriture','=','ecritures.id')
            ->where('lignes.compte', $account)
            ->whereRaw(
                "STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') BETWEEN ? AND ?",
                [$start, $end]
            )
            ->select(
                'ecritures.id as ecriture_id',
                'lignes.id as line_id',
                DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
                'ecritures.journal as journal_code',
                'ecritures.label as label_ecriture',
                'lignes.commentaire',
                'lignes.montant'
            )
            ->orderBy('date_iso')
            ->orderBy('lignes.id')
            ->get();
        return view('consult.grand-livre', compact(
            'comptes','account','prev','next',
            'start','end','earliest','latest','lignes',
            'preserveLineIds','preserveAccount','preserveStart','preserveEnd','newCompte'
        ));
    }
	
	/**
	* Affiche le journal pour un code de journal donné.
	*/
	public function journal(Request $request)
	{
		// 1) Récupérer tous les codes/noms de journaux
		$journaux = DB::table('journaux')->orderBy('code')->get();

		// 2) Code de journal sélectionné (par défaut le premier)
		$journalCode = $request->query('journal', optional($journaux->first())->code);

		// 3) Période facultative (si vous voulez garder le filtre de dates)
		$minRaw = DB::table('ecritures')
			->selectRaw("MIN(STR_TO_DATE(`date`, '%d/%m/%Y')) AS min_date")
			->value('min_date');
		$maxRaw = DB::table('ecritures')
			->selectRaw("MAX(STR_TO_DATE(`date`, '%d/%m/%Y')) AS max_date")
			->value('max_date');
		$earliest = $minRaw ? date('Y-m-d', strtotime($minRaw)) : date('Y-m-d');
		$latest   = $maxRaw ? date('Y-m-d', strtotime($maxRaw)) : date('Y-m-d');

		$start = $request->query('start', $earliest);
		$end   = $request->query('end',   $latest);

		// 4) Récupérer les lignes filtrées par journal + date
		$lignes = DB::table('lignes')
			->join('ecritures','lignes.ecriture','=','ecritures.id')
			->where('ecritures.journal', $journalCode)
			->whereRaw(
				"STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') BETWEEN ? AND ?",
				[$start, $end]
			)
			->select(
				'ecritures.id AS num_ecriture',
				'lignes.id as line_id',
				DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
				'lignes.compte',
				'ecritures.label as libelle',
				'lignes.commentaire',
				'lignes.montant'
			)
			->orderBy('ecritures.id', 'desc')    // tri par Num. Ecr. décroissant par défaut
			->get();
		return view('consult.journal', compact(
			'journaux','journalCode','start','end','earliest','latest','lignes'
		));
	}

	

    /**
     * Supprime en masse.
     */
    public function bulkDelete(Request $request)
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
            ->route('consult.grand_livre', [
                'account'      => $request->input('account'),
                'period_start' => $request->input('period_start'),
                'period_end'   => $request->input('period_end'),
            ])
            ->with('success', count($ecritureIds).' écriture(s) supprimée(s).');
    }

    /**
     * Duplique en masse.
     */
    public function bulkDuplicate(Request $request)
    {
        $lineIds = array_filter(explode(',', $request->input('line_ids', '')));
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

                return $copy;
            });
		event(new DatabaseUpdated());
        return redirect()
            ->route('consult.grand_livre', [
                'account'      => $request->input('account'),
                'period_start' => $request->input('period_start'),
                'period_end'   => $request->input('period_end'),
            ])
            ->with('success', count($new).' écriture(s) dupliquée(s).');
    }

    /**  
     * Transfert en masse depuis le grand-livre.  
     */  
    public function bulkTransfer(Request $request)  
    {  
        $lineIds       = array_filter(explode(',', $request->input('line_ids', '')));  
        $initialAccount = $request->input('account');  
        $newCompte     = $request->input('transfer_account');  
  
        Ligne::whereIn('id', $lineIds)  
             ->update(['compte' => $newCompte]);  
		event(new DatabaseUpdated());
        return redirect()  
            ->route('consult.grand_livre', [  
                'account'      => $initialAccount,  
                'period_start' => $request->input('period_start'),  
                'period_end'   => $request->input('period_end'),  
            ])  
            ->with('success', count($lineIds).' ligne(s) transférée(s).');  
    }  

    /**
     * Export PDF / Excel des lignes sélectionnées du grand-livre.
     */
    public function bulkExport(Request $request)
    {
        $lineIds = array_filter(explode(',', $request->input('line_ids', '')));
        $format  = $request->input('export_format');
        $account = $request->input('account');
        $start   = $request->input('period_start');
        $end     = $request->input('period_end');

        $query = DB::table('lignes')
            ->join('ecritures','lignes.ecriture','=','ecritures.id')
            ->whereIn('lignes.id', $lineIds)
            ->select(
                DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
                'ecritures.journal as journal',
                'lignes.ecriture as ecriture_id',
                'ecritures.label as label_ecriture',
                'lignes.commentaire',
                'lignes.montant'
            )
            ->orderBy('date_iso')
            ->orderBy('lignes.id');

        $lines = $query->get();

        $exportData = [];
        $cum = 0;
        foreach ($lines as $ln) {
            $cum += $ln->montant;

            if ($format === 'pdf') {
                $m = number_format($ln->montant,2,',',' ').' €';
                $c = number_format($cum,      2,',',' ').' €';
            } else {
                $m = number_format($ln->montant,2,',','');
                $c = number_format($cum,      2,',','');
            }

            $exportData[] = [
                'Date'        => Carbon::parse($ln->date_iso)->format('d/m/Y'),
                'Journal'     => $ln->journal,
                'N° Ecr.'     => $ln->ecriture_id,
                'Libellé'     => $ln->label_ecriture,
                'Commentaire' => $ln->commentaire,
                'Montant'     => $m,
                'Cumul'       => $c,
            ];
        }

        if ($format === 'pdf') {
            $pdf = Pdf::loadView('consult.export-pdf', [
                'lignes'  => $exportData,
                'account' => $account,
                'start'   => $start,
                'end'     => $end,
            ])->setPaper('a4', 'landscape');
            return $pdf->download("grand-livre-{$account}.pdf");
        }

        return Excel::download(new LignesExport($exportData), "grand-livre-{$account}.xlsx");
    }
	
	public function journalBulkTransfer(Request $request)
    {
		
        // 1) IDs des lignes sélectionnées
        $lineIds = array_filter(explode(',', $request->input('line_ids', '')));

        // 2) Nouveau code de journal
		$currentJournal = $request->input('journal');
        $newJournal = $request->input('transfer_journal');

        // 3) On récupère d’abord les IDs d’écritures uniques
        $ecritureIds = Ligne::whereIn('id', $lineIds)
                            ->pluck('ecriture')
                            // ->unique()
                            ->toArray();

        // 4) On met à jour le champ journal de ces écritures
        Ecriture::whereIn('id', $ecritureIds)
                 ->update(['journal' => $newJournal]);

        // 5) Retour vers l’onglet Journal avec le contexte et message
		event(new DatabaseUpdated());
        return redirect()
            ->route('ecritures.journal', [
                'journal' => $currentJournal,
                'start'   => $request->input('start'),
                'end'     => $request->input('end'),
            ])
            ->with('success', count($ecritureIds).' écriture(s) transférée(s).')
            ->with('preserve_line_ids', $request->input('line_ids'));
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
			])->setPaper('a4', 'portrait');

			return $pdf->download("journal-{$journal}_{$start}_{$end}.pdf");
		}

		return Excel::download(new LignesExport($exportData), "journal-{$journal}_{$start}_{$end}.xlsx");
	}
	
	public function search(Request $request)
    {
        // 1) listes pour le formulaire
        $journaux = DB::table('journaux')->orderBy('code')->get();
        $comptes  = DB::table('comptes')->orderBy('numero')->get();

        // 2) construction de la requête
        $query = DB::table('lignes')
            ->join('ecritures', 'lignes.ecriture', '=', 'ecritures.id')
            ->select(
                'lignes.id as line_id',
                'ecritures.id as num_ecriture',
                DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
                'ecritures.journal',
                'lignes.compte',
                'ecritures.label as libelle_ecriture',
                'lignes.commentaire',
                'lignes.montant'
            );

        // 3) filtres facultatifs

        // Dates
        if ($request->filled('date_min')) {
            $query->whereRaw(
                "STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') >= ?",
                [$request->date_min]
            );
        }
        if ($request->filled('date_max')) {
            $query->whereRaw(
                "STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') <= ?",
                [$request->date_max]
            );
        }

        // Montants
        if ($request->filled('montant_min')) {
            $query->where('lignes.montant', '>=', $request->montant_min);
        }
        if ($request->filled('montant_max')) {
            $query->where('lignes.montant', '<=', $request->montant_max);
        }

        // Libellé écriture
        if ($request->filled('libelle')) {
            $query->where('ecritures.label', 'like', '%'.$request->libelle.'%');
        }

        // Commentaire ligne
        if ($request->filled('commentaire')) {
            $query->where('lignes.commentaire', 'like', '%'.$request->commentaire.'%');
        }

        // Journal
        if ($request->filled('journal')) {
            $query->where('ecritures.journal', $request->journal);
        }

        // Comptes (gérer plusieurs valeurs grâce à whereIn)
        if ($request->filled('compte')) {
            $accountList = $request->input('compte'); // tableau de numéros
            $query->whereIn('lignes.compte', $accountList);
        }

        // 4) exécution et ordonnancement
        $lignes = $query
            ->orderByRaw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') asc")
            ->orderBy('lignes.id')
            ->get();
        // 5) renvoi vers la vue
        return view('consult.search', [
            'journaux'      => $journaux,
            'comptes'       => $comptes,
            'lignes'        => $lignes,
            'dateMin'       => $request->date_min,
            'dateMax'       => $request->date_max,
            'montantMin'    => $request->montant_min,
            'montantMax'    => $request->montant_max,
            'libelle'       => $request->libelle,
            'commentaire'   => $request->commentaire,
            'journalCode'   => $request->journal,
        ]);
    }

    /**
     * Suppression en masse depuis la recherche.
     */
    public function searchBulkDelete(Request $request)
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
            ->route('consult.search', $request->only([
                'date_min','date_max',
                'montant_min','montant_max',
                'libelle','commentaire',
                'journal','compte'
            ]))
            ->with('success', count($ecritureIds).' écriture(s) supprimée(s).');
    }

    /**
     * Duplication en masse depuis la recherche.
     */
    public function searchBulkDuplicate(Request $request)
    {
        $lineIds = array_filter(explode(',', $request->input('line_ids', '')));
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
            ->route('consult.search', $request->only([
                'date_min','date_max',
                'montant_min','montant_max',
                'libelle','commentaire',
                'journal','compte'
            ]))
            ->with('success', count($new).' écriture(s) dupliquée(s).');
    }

    /**
     * Transfert en masse depuis la recherche.
     */
    public function searchBulkTransfer(Request $request)
    {
        $lineIds      = array_filter(explode(',', $request->input('line_ids', '')));
        $newCompte    = $request->input('transfer_account');

        Ligne::whereIn('id', $lineIds)
             ->update(['compte' => $newCompte]);
		event(new DatabaseUpdated());
        return redirect()
            ->route('consult.search', $request->only([
                'date_min','date_max',
                'montant_min','montant_max',
                'libelle','commentaire',
                'journal','compte'
            ]))
            ->with('success', count($lineIds).' ligne(s) transférée(s).');
    }

    /**
     * Export Excel/PDF en masse depuis la recherche.
     */
    public function searchBulkExport(Request $request)
    {
        $lineIds = array_filter(explode(',', $request->input('line_ids', '')));
        $format  = $request->input('export_format', 'excel');

        $lines = DB::table('lignes')
            ->join('ecritures','lignes.ecriture','=','ecritures.id')
            ->whereIn('lignes.id', $lineIds)
            ->select(
                DB::raw("STR_TO_DATE(ecritures.`date`, '%d/%m/%Y') as date_iso"),
                'ecritures.journal',
                'lignes.ecriture as ecriture_id',
                'ecritures.label as label_ecriture',
                'lignes.commentaire',
                'lignes.montant'
            )
            ->orderBy('date_iso')
            ->orderBy('lignes.id')
            ->get();

        $exportData = [];
        $cum = 0;
        foreach ($lines as $ln) {
            $cum += $ln->montant;
            if ($format === 'pdf') {
                $m = number_format($ln->montant, 2, ',', ' ').' €';
                $c = number_format($cum,        2, ',', ' ').' €';
            } else {
                $m = number_format($ln->montant, 2, ',', '');
                $c = number_format($cum,         2, ',', '');
            }
            $exportData[] = [
                'Date'        => Carbon::parse($ln->date_iso)->format('d/m/Y'),
                'Journal'     => $ln->journal,
                'N° Ecr.'     => $ln->ecriture_id,
                'Libellé'     => $ln->label_ecriture,
                'Commentaire' => $ln->commentaire,
                'Montant'     => $m,
                'Cumul'       => $c,
            ];
        }

        if ($format === 'pdf') {
            $pdf = Pdf::loadView('consult.export-pdf', [
                'lignes'  => $exportData,
                'account' => null,
                'start'   => null,
                'end'     => null,
            ])->setPaper('a4', 'landscape');

            return $pdf->download("search-export.pdf");
        }

        return Excel::download(new LignesExport($exportData), "search-export.xlsx");
    }
	
}

