CREATE TABLE "atendeia_atendimento_envios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"chave" uuid NOT NULL,
	"status" text DEFAULT 'enviando' NOT NULL,
	"provedor_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid NOT NULL,
	CONSTRAINT "atendeia_atendimento_status" CHECK ("atendeia_atendimento_envios"."status" IN ('enviando', 'enviado', 'incerto'))
);
--> statement-breakpoint
ALTER TABLE "atendeia_contacts" ADD COLUMN "foto_url" text;--> statement-breakpoint
ALTER TABLE "atendeia_atendimento_envios" ADD CONSTRAINT "atendeia_atendimento_envios_conversa_id_atendeia_conversations_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."atendeia_conversations"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "atendeia_atendimento_envios" ADD CONSTRAINT "atendeia_atendimento_envios_modified_by_atendeia_users_id_fk" FOREIGN KEY ("modified_by") REFERENCES "public"."atendeia_users"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "atendeia_atendimento_chave" ON "atendeia_atendimento_envios" USING btree ("chave");