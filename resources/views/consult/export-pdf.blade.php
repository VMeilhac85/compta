{{-- resources/views/consult/export-pdf.blade.php --}}
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 12px;
        }
        h1 {
            text-align: center;
            margin-bottom: 0.2em;
        }
        h2.period {
            text-align: center;
            margin-top: 0;
            margin-bottom: 1rem;
            font-size: 12px;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed; /* assure que les colgroup soient appliqués */
        }
        th, td {
            border: 1px solid #000;
            padding: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        th {
            background: #eee;
        }
        .text-end {
            text-align: right;
        }
    </style>
</head>
<body>
    <h1>Extrait de grand-livre – Compte {{ $account }}</h1><BR>

    <table>
        <colgroup>
            <col style="width:8%">
            <col style="width:6%">
            <col style="width:6%">
            <col style="width:28%">
            <col style="width:28%">
            <col style="width:12%">
            <col style="width:12%">
        </colgroup>
        <thead>
            <tr>
                <th width="8%">Date</th>
                <th width="6%">Journal</th>
                <th width="6%">N° Ecr.</th>
                <th width="28%">Libellé</th>
                <th width="28%">Commentaire</th>
                <th width="12%" class="text-end">Montant</th>
                <th width="12%" class="text-end">Cumul</th>
            </tr>
        </thead>
        <tbody>
            @foreach($lignes as $ln)
            <tr>
                <td>{{ $ln['Date'] }}</td>
                <td>{{ $ln['Journal'] }}</td>
                <td>{{ $ln['N° Ecr.'] }}</td>
                <td>{{ $ln['Libellé'] }}</td>
                <td>{{ $ln['Commentaire'] }}</td>
                <td class="text-end">{{ $ln['Montant'] }}</td>
                <td class="text-end">{{ $ln['Cumul'] }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
