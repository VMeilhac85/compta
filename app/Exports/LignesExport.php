<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;

class LignesExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize
{
    protected array $data;

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function collection()
    {
        return new Collection($this->data);
    }

    public function headings(): array
    {
        // si on a une colonne "Journal", c'est l'export grand-livre
        if (isset($this->data[0]['Journal'])) {
            return [
                'Date',
                'Journal',
                'N° Écr.',
                'Libellé',
                'Commentaire',
                'Montant',
                'Cumul',
            ];
        }

        // sinon c'est l'export journal
        return [
            'N° Écr.',
            'Date',
            'Compte',
            'Libellé',
            'Commentaire',
            'Montant',
        ];
    }

    public function map($row): array
    {
        if (isset($row['Journal'])) {
            // export grand-livre
            return [
                $row['Date'],
                $row['Journal'],
                $row['N° Écr.'],
                $row['Libellé'],
                $row['Commentaire'],
                $row['Montant'],
                $row['Cumul'],
            ];
        }

        // export journal
        return [
            $row['Num. Écr.'],
            $row['Date'],
            $row['Compte'],
            $row['Libellé'],
            $row['Commentaire'],
            $row['Montant'],
        ];
    }
}
