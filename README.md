# ⚡ Gestion Affaire MT-BT · Version PRO
**SRM Tanger-Tétouan-Al Hoceima — Direction Provinciale d'Ouezzane**  
**Préparateur de l'application :** `A. DARRAGE`

---

## 📁 Structure du Projet (`C:\Users\pc\Desktop\affaire MT-BT`)

```text
affaire MT-BT/
├── index.html                          # Application principale modulaire (HTML5)
├── Gestion_Affaire_MT_BT_Portable.html # Version Portable autonome (1 seul fichier tout-en-un)
├── Lancer_Application.bat              # Script de lancement rapide sous Windows
├── README.md                           # Documentation & Guide d'utilisation
├── css/
│   └── styles.css                      # Styles PRO (4 thèmes + Mise en page A4 impression/PDF)
├── js/
│   ├── catalog.js                      # Base de données Série des Prix SRM-TTA (722 articles)
│   ├── logo.js                         # Logo officiel SRM-TTA encodé en Base64
│   └── app.js                          # Cœur applicatif (Portail Affaires, Bordereau, Devis, Récolement)
├── assets/
│   └── logo-srm-tta.jpg                # Fichier image du logo officiel SRM-TTA
└── data/
    └── sauvegarde_exemple.json         # Exemple de sauvegarde JSON importable
```

---

## 🚀 Fonctionnalités Clés

1. **Portail de Sélection & Gestion des Affaires** :
   - Classement automatique avec **l'affaire la plus récente en haut** (`SET/DPO/112/2026` → `111` → `110`...).
   - Filtrage et regroupement par **Mois d'Étude** et par **Année** avec sous-totaux TTC.
   - Sélection rapide d'une affaire avant d'entrer pour modifier son contenu.
2. **Système Hybride de Structure Réseau (5 Sections au choix)** :
   - `⚡ Ligne MT`
   - `⚡ Ligne MT Hors site`
   - `⚡ Ligne MT In Site`
   - `🏢 Poste`
   - `🔌 Ligne BT`
   - Regroupement par section avec sous-totaux HT et ordre d'affichage personnalisable.
3. **Bordereau des Prix & Série des Prix SRM-TTA** :
   - Saisie directe des quantités lors de la sélection d'articles dans le catalogue.
   - Sélection multiple (cases à cocher) pour supprimer plusieurs articles en un clic.
   - Importation automatique d'un Bordereau depuis un fichier **PDF** ou **JSON**.
4. **Règles de Signature des Prestations SRM-TTA (Modifiables)** :
   - `≤ 50k DH` : **Directeur Provincial**
   - `50k DH – 500k DH` : **Directeur Clientèle**
   - `> 500k DH` : **La Directrice Générale**
5. **Documents Officiels & Chiffrage Après Récolement** :
   - Page de garde officielle, Devis / Facture, Lettre client, Fiche d'étude, Feuille d'attachement et Fiche suiveuse.
   - Export direct en **PDF A4** et **Excel (`.xlsx`)**.
