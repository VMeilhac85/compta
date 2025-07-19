<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
	{
		Schema::create('lignes', function (Blueprint $table) {
			$table->id();
			$table->foreignId('ecriture')->constrained('ecritures')->cascadeOnDelete();
			$table->unsignedInteger('compte');
			$table->decimal('montant', 15, 2);
			$table->text('commentaire')->nullable();
			$table->timestamps();
		});
	}


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lignes');
    }
};
