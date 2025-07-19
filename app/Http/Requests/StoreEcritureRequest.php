<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEcritureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }
	
	protected function prepareForValidation(): void
    {
        $lignes = $this->input('lignes', []);
        foreach ($lignes as $i => $ligne) {
            if (isset($ligne['montant'])) {
                // Supprime espaces et '€', remplace ',' par '.'
                $raw = preg_replace('/[ \s€]/u', '', $ligne['montant']);
                $raw = str_replace(',', '.', $raw);
                $lignes[$i]['montant'] = $raw;
            }
        }
        $this->merge(['lignes' => $lignes]);
    }

    public function rules(): array
    {
        return [
            'journal'             => 'required|string|exists:journaux,code',
            'date'                => 'required|date_format:d/m/Y',
            'label'               => 'required|string|max:255',
            'lignes'              => 'required|array|min:2',
            'lignes.*.compte'     => 'required|integer|exists:comptes,numero',
            // ← on enlève numeric !
            'lignes.*.montant' => [
                'required',
                'regex:/^-?\d+(\.\d{1,2})?$/'
            ],
            'lignes.*.commentaire'=> 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'journal.required'            => 'Le choix du journal est obligatoire.',
            'journal.exists'              => 'Le journal sélectionné n’est pas reconnu.',
            'date.required'               => 'Veuillez saisir une date.',
            'date.date_format'            => 'La date doit être au format jj/mm/aaaa.',
            'label.required'              => 'Le libellé est obligatoire.',
            'lignes.required'             => 'Ajoutez au moins deux lignes pour équilibrer la saisie.',
            'lignes.*.compte.exists'      => 'Le compte sélectionné est invalide.',
            'lignes.*.montant.required'   => 'Le montant est obligatoire.',
            'lignes.*.montant.regex'      => 'Le montant doit être un nombre valide (max. 2 décimales, séparateur “.”).',
        ];
    }
}
