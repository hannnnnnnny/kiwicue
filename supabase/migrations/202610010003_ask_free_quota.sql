-- Kiwi now searches on every message, so a conversation spends several searches. Each costs
-- about NZ$0.0004 and the NZ$0.50 daily budget still caps the total.
update public.ask_limits set per_day = 15 where tier = 'guest';
update public.ask_limits set per_day = 50 where tier = 'free';
