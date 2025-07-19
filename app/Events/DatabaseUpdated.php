<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
// Importez bien l’interface depuis Contracts :
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DatabaseUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Le channel (public) sur lequel on broadcast.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('global');
    }

    /**
     * Les données envoyées côté client.
     */
    public function broadcastWith(): array
    {
        return [
            'time' => now()->toDateTimeString(),
        ];
    }
}
