const fr = {
  onboarding: {
    eyebrow: 'Gami DigiDouble',
    title: 'Créez votre identité locale',
    lead: "Votre profil est stocké dans ce navigateur et synchronisé avec le moteur d'expérience.",
    name: {
      label: 'Nom',
      placeholder: 'Comment les avatars doivent-ils vous appeler ?',
    },
    roleInWorld: {
      label: 'Rôle dans le monde',
      placeholder: 'Détective, voyageur, conservateur...',
    },
    avatarRelationships: {
      label: 'Relations avec les avatars',
      placeholder: 'Séparés par une virgule ou un saut de ligne',
    },
    dialogueGuidance: {
      label: 'Guide de dialogue',
      placeholder: 'Comment les avatars doivent-ils interagir avec vous ?',
    },
    saving: 'Enregistrement…',
    save: "Enregistrer l'identité",
    error: {
      server: "Impossible d'enregistrer l'identité sur le serveur : {{message}}",
      generic: "Impossible d'enregistrer votre identité. Veuillez réessayer.",
    },
  },
  active: {
    eyebrow: 'Expérience publique',
    title: 'Bienvenue',
    lead: 'Choisissez un scénario pour découvrir les avatars disponibles pour votre session.',
    resetIdentity: "Réinitialiser l'identité",
  },
  identity: {
    name: 'Nom',
    roleInWorld: 'Rôle dans le monde',
    relationships: 'Relations',
    dialogueGuidance: 'Guide de dialogue',
    notSet: 'Non défini',
  },
  scenarios: {
    title: 'Scénarios disponibles',
    loading: 'Chargement des scénarios…',
    error: 'Impossible de charger les scénarios.',
    empty: "Aucun scénario actif n'est disponible pour le moment.",
    ariaLabel: 'Liste des scénarios',
  },
  avatars: {
    title: 'Avatars disponibles',
    selectScenario: 'Sélectionnez un scénario pour afficher les avatars disponibles.',
    loading: 'Chargement des avatars disponibles…',
    empty:
      "Aucun avatar n'est disponible actuellement. Gardez cette page ouverte pour les déblocages.",
    ariaLabel: 'Avatars disponibles',
  },
  chat: {
    title: 'Chat actuel',
    noAvatars: "Aucun avatar disponible pour l'instant. Les déblocages apparaîtront ici.",
    pickAvatar: 'Choisissez un avatar disponible pour démarrer un fil de discussion actif.',
    avatarsAriaLabel: 'Avatars de chat disponibles',
    starting: 'Démarrage du chat…',
    currentThread: 'Fil actuel',
    startChat: 'Démarrer le chat',
    selectAvatar: 'Sélectionnez un avatar pour ouvrir votre fil actuel.',
    noMessages: 'Aucun message pour le moment. Envoyez le premier.',
    avatarResponding: "L'avatar répond…",
    message: {
      label: 'Message',
      placeholder: 'Écrivez votre message...',
    },
    sending: 'Envoi…',
    send: 'Envoyer',
    endConversation: 'Terminer la conversation',
    meta: {
      sending: ' · envoi…',
      failed: ' · échec',
    },
  },
  errors: {
    sessionUnavailable: 'Session indisponible. Veuillez sélectionner un scénario à nouveau.',
    unableToStartChat: 'Impossible de démarrer le chat',
    unableToRestoreConversation: 'Impossible de restaurer la conversation précédente',
    unableToSendMessage: "Impossible d'envoyer le message",
    unableToEndConversation: 'Impossible de terminer la conversation',
    unableToLoadScenarios: 'Impossible de charger les scénarios',
    unableToRefreshAvatars: "Impossible d'actualiser la disponibilité des avatars",
    unableToLoadAvatars: 'Impossible de charger les avatars',
  },
  language: {
    label: 'Langue',
    en: 'English',
    fr: 'Français',
  },
} as const

export default fr
