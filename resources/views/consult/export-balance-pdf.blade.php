{{-- resources/views/consult/export-balance-pdf.blade.php --}}
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
        th.text-center {
            text-align: center;
        }
        .text-end {
            text-align: right;
        }
    </style>
</head>
<body>
    <h1>Extrait de balance</h1>
    <h2 class="period">
        Période : {{ \Carbon\Carbon::parse($period1Start)->format('d/m/Y') }}
        au {{ \Carbon\Carbon::parse($period1End)->format('d/m/Y') }}
        @if($enableCompare)
          <br>
          Comparaison : {{ \Carbon\Carbon::parse($period2Start)->format('d/m/Y') }}
          au {{ \Carbon\Carbon::parse($period2End)->format('d/m/Y') }}
        @endif
    </h2>
    <table>
        <colgroup>
            <col style="width:12%">
            <col style="width:37%">
            <col style="width:17%">
            @if($enableCompare)
              <col style="width:17%">
              <col style="width:17%">
            @endif
        </colgroup>
        <thead>
            <tr>
                <th width="12%">Compte</th>
                <th width="37%">Nom compte</th>
                <th width="17%" class="text-center">Solde</th>
                @if($enableCompare)
                  <th width="17%" class="text-center">Solde comparé</th>
                  <th width="17%" class="text-center">Variation</th>
                @endif
            </tr>
        </thead>
        <tbody>
            @foreach($lignes as $ln)
            <tr>
                <td>{{ $ln['compte'] }}</td>
                <td>{{ $ln['libelle'] }}</td>
                <td class="text-end">{{ number_format($ln['solde1'],2,',',' ') }} €</td>
                @if($enableCompare)
                  <td class="text-end">{{ number_format($ln['solde2'],2,',',' ') }} €</td>
                  <td class="text-end">{{ number_format($ln['variation'],2,',',' ') }} €</td>
                @endif
            </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
