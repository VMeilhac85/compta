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
            margin: 0.2em 0 1em;
            font-size: 12px;
            color: #555;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
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
    <h1>Extraction du journal : {{ $journal }}</h1><BR>

    <table>
        <colgroup>
            <col style="width:7%">
            <col style="width:11%">
            <col style="width:9%">
            <col style="width:23%">
            <col style="width:39%">
            <col style="width:13%">
        </colgroup>
        <thead>
            <tr>
                <th width="7%">N°Écr</th>
                <th width="11%">Date</th>
                <th width="9%">Compte</th>
                <th width="22%">Libellé</th>
                <th width="38%">Commentaire</th>
                <th width="13%" class="text-end">Montant</th>
            </tr>
        </thead>
        <tbody>
            @foreach($lignes as $ln)
            <tr>
                <td>{{ $ln['Num. Écr.'] }}</td>
                <td>{{ $ln['Date'] }}</td>
                <td>{{ $ln['Compte'] }}</td>
                <td>{{ $ln['Libellé'] }}</td>
                <td>{{ $ln['Commentaire'] }}</td>
                <td class="text-end">{{ $ln['Montant'] }} €</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
