<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class BalanceExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize
{
    /**
     * Les données de la balance.
     *
     * @var array<int, array<string, mixed>>
     */
    protected array $data;

    /**
     * @param  array<int, array<string, mixed>>  $data
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Retourne une collection Laravel pour l'export.
     */
    public function collection()
    {
        return new Collection($this->data);
    }

    /**
     * Définit les entêtes de colonnes de l'export.
     *
     * @return string[]
     */
    public function headings(): array
    {
        $hasCompare = isset($this->data[0]['solde2']);

        $headings = [
            'Compte',
            'Nom compte',
            'Solde',
        ];

        if ($hasCompare) {
            $headings[] = 'Solde comparé';
            $headings[] = 'Variation';
        }

        return $headings;
    }

    /**
     * Mappe chaque ligne pour l'export, en arrondissant à 2 décimales.
     *
     * @param  array<string, mixed>  $row
     * @return array<int, mixed>
     */
    public function map($row): array
    {
        $mapped = [
            $row['compte'],
            $row['libelle'],
            round($row['solde1'], 2),
        ];

        if (isset($row['solde2'])) {
            $mapped[] = round($row['solde2'], 2);
            $mapped[] = round($row['variation'], 2);
        }

        return $mapped;
    }
}
